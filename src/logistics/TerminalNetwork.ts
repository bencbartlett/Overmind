import {log} from '../console/log';
import {Mem} from '../Memory';
import {profile} from '../profiler/decorator';
import {Energetics} from './Energetics';
import {Colony} from '../Colony';
import {maxBy, mergeSum, minBy, minMax} from '../utilities/utils';
import {RESOURCE_IMPORTANCE} from '../resources/map_resources';
import {wantedStockAmounts} from '../resources/Abathur';

interface TerminalNetworkMemory {
	equalizeIndex: number;
}

const TerminalNetworkMemoryDefaults = {
	equalizeIndex: 0
};

function colonyOf(terminal: StructureTerminal): Colony {
	return Overmind.colonies[terminal.room.name];
}

function wantedAmount(colony: Colony, resource: ResourceConstant): number {
	return (wantedStockAmounts[resource] || 0) - (colony.assets[resource] || 0);
}


export const TerminalState_Evacuate = {
	amounts  : {},
	tolerance: 500
};

export const TerminalState_Emergency = {
	amounts  : {
		[RESOURCE_ENERGY]                      : 25000,
		[RESOURCE_CATALYZED_GHODIUM_ALKALIDE]  : 2000,
		// [RESOURCE_CATALYZED_GHODIUM_ACID]      : 2000,
		[RESOURCE_CATALYZED_ZYNTHIUM_ACID]     : 2000,
		[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] : 2000,
		[RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: 2000,
		[RESOURCE_CATALYZED_LEMERGIUM_ACID]    : 2000,
		[RESOURCE_CATALYZED_KEANIUM_ALKALIDE]  : 2000,
		// [RESOURCE_CATALYZED_KEANIUM_ACID]      : 2000,
		[RESOURCE_CATALYZED_UTRIUM_ACID]       : 2000,
		// [RESOURCE_CATALYZED_UTRIUM_ALKALIDE]   : 2000,
	},
	tolerance: 500
};

export const TerminalState_Rebuild = {
	amounts  : {
		[RESOURCE_ENERGY]: 25000,
	},
	tolerance: 500
};

@profile
export class TerminalNetwork implements ITerminalNetwork {

	terminals: StructureTerminal[];					// All terminals
	readyTerminals: StructureTerminal[];
	exceptionTerminals: { [terminalID: string]: TerminalState }; 		// Terminals in a special operational state
	assets: { [resourceType: string]: number };		// All assets
	private averageFullness: number;
	private alreadyReceived: StructureTerminal[];
	private alreadySent: StructureTerminal[];
	private cache: {
		sellPrice: { [resourceType: string]: number }
	};
	settings: {
		equalize: {
			frequency: number,
			maxSendSize: number,
			tolerance: {
				energy: number,
				power: number,
				default: number,
				[resourceType: string]: number,
			}
		}
	};

	memory: TerminalNetworkMemory;

	constructor(terminals: StructureTerminal[]) {
		this.terminals = terminals;
		this.readyTerminals = _.filter(terminals, t => t.cooldown == 0);
		this.memory = Mem.wrap(Memory.Overmind, 'terminalNetwork', TerminalNetworkMemoryDefaults);
		this.alreadyReceived = [];
		this.alreadySent = [];
		this.exceptionTerminals = {}; 		// populated in init()
		this.assets = {}; 					// populated in init()
		this.settings = {
			equalize: {
				frequency  : 100,
				maxSendSize: 25000,
				tolerance  : {
					energy : 50000,
					power  : 5000,
					default: 1000
				}
			}
		};
		this.averageFullness = _.sum(_.map(this.terminals,
										   t => _.sum(t.store) / t.storeCapacity)) / this.terminals.length;
	}

	/* Summarizes the total of all resources currently in a colony store structure */
	private getAllAssets(): { [resourceType: string]: number } {
		return mergeSum(_.map(this.terminals, terminal => colonyOf(terminal).assets));
	}

	static get stats() {
		return Mem.wrap(Memory.stats.persistent, 'terminalNetwork');
	}

	static logTransfer(resourceType: ResourceConstant, amount: number, origin: string, destination: string) {
		if (!this.stats.transfers) this.stats.transfers = {};
		if (!this.stats.transfers[resourceType]) this.stats.transfers[resourceType] = {};
		if (!this.stats.transfers[resourceType][origin]) this.stats.transfers[resourceType][origin] = {};
		if (!this.stats.transfers[resourceType][origin][destination]) {
			this.stats.transfers[resourceType][origin][destination] = 0;
		}
		this.stats.transfers[resourceType][origin][destination] += amount;
		this.logTransferCosts(amount, origin, destination);
	}

	private static logTransferCosts(amount: number, origin: string, destination: string) {
		if (!this.stats.transfers.costs) this.stats.transfers.costs = {};
		if (!this.stats.transfers.costs[origin]) this.stats.transfers.costs[origin] = {};
		if (!this.stats.transfers.costs[origin][destination]) this.stats.transfers.costs[origin][destination] = 0;
		let transactionCost = Game.market.calcTransactionCost(amount, origin, destination);
		this.stats.transfers.costs[origin][destination] += transactionCost;
	}

	/* Whether the terminal is actively requesting energy */
	private terminalNeedsEnergy(terminal: StructureTerminal): boolean {
		return terminal.energy < Energetics.settings.terminal.energy.inThreshold;
	}

	/* Amount of space available in storage and terminal */
	private remainingRoomCapacity(room: Room): number {
		let remainingCapacity = 0;
		if (room.storage) {
			remainingCapacity += room.storage.storeCapacity - _.sum(room.storage.store);
		}
		if (room.terminal) {
			remainingCapacity += room.terminal.storeCapacity - _.sum(room.terminal.store);
		}
		return remainingCapacity;
	}

	/* Amount of energy in storage and terminal */
	private energyInRoom(room: Room): number {
		let energyInRoom = 0;
		if (room.storage) {
			energyInRoom += room.storage.energy;
		}
		if (room.terminal) {
			energyInRoom += room.terminal.energy;
		}
		return energyInRoom;
	}

	private transfer(sender: StructureTerminal, receiver: StructureTerminal, resourceType: ResourceConstant,
					 amount: number): number {
		let cost = Game.market.calcTransactionCost(amount, sender.room.name, receiver.room.name);
		let response = sender.send(resourceType, amount, receiver.room.name);
		if (response == OK) {
			log.info(`Sent ${amount} ${resourceType} from ${sender.room.print} to ` +
					 `${receiver.room.print}. Fee: ${cost}.`);
			TerminalNetwork.logTransfer(resourceType, amount, sender.room.name, receiver.room.name);
			this.alreadySent.push(sender);
			this.alreadyReceived.push(receiver);
		} else {
			log.warning(`Could not send ${amount} ${resourceType} from ${sender.room.print} to ` +
						`${receiver.room.print}! Response: ${response}`);
		}
		return response;
	}

	requestResource(receiver: StructureTerminal, resourceType: ResourceConstant, amount: number,
					allowBuy = true, minDifference = 4000): void {
		if (this.exceptionTerminals[receiver.ref]) {
			return; // don't send to abandoning terminals
		}
		amount = Math.max(amount, TERMINAL_MIN_SEND);
		let possibleSenders = _.filter(this.terminals,
									   terminal => (terminal.store[resourceType] || 0) > amount + minDifference &&
												   terminal.cooldown == 0 && !this.alreadySent.includes(terminal));
		let sender: StructureTerminal | undefined = maxBy(possibleSenders, t => (t.store[resourceType] || 0));
		if (sender) {
			this.transfer(sender, receiver, resourceType, amount);
		} else if (allowBuy) {
			Overmind.tradeNetwork.buyMineral(receiver, resourceType, amount);
		}
	}

	/* Sell excess minerals on the market */

	private handleExcess(terminal: StructureTerminal, threshold = 25000): void {
		let terminalNearCapacity = _.sum(terminal.store) > 0.9 * terminal.storeCapacity;
		let energyOrders = _.filter(Game.market.orders, order => order.type == ORDER_SELL &&
																 order.resourceType == RESOURCE_ENERGY);
		let energyThreshold = Energetics.settings.terminal.energy.outThreshold
							  + Energetics.settings.terminal.energy.sendSize;
		for (let resource in terminal.store) {
			if (resource == RESOURCE_POWER) {
				continue;
			}
			if (resource == RESOURCE_ENERGY) {
				if (terminal.store[RESOURCE_ENERGY] > energyThreshold) {
					if (terminalNearCapacity) { // just get rid of stuff at high capacities
						Overmind.tradeNetwork.sellDirectly(terminal, RESOURCE_ENERGY, 10000);
					} else if (energyOrders.length < 3) {
						Overmind.tradeNetwork.sell(terminal, RESOURCE_ENERGY, 50000);
					}
				}
			} else {
				if (terminal.store[<ResourceConstant>resource]! > threshold) {
					let receiver = maxBy(this.terminals,
										 terminal => wantedAmount(colonyOf(terminal),
																  <ResourceConstant>resource));
					if (receiver && wantedAmount(colonyOf(receiver), <ResourceConstant>resource) > TERMINAL_MIN_SEND) {
						// Try to send internally first
						this.transfer(terminal, receiver, <ResourceConstant>resource, 1000);
					} else {
						// Sell excess
						if (terminalNearCapacity || terminal.store[<ResourceConstant>resource]! > 2 * threshold) {
							Overmind.tradeNetwork.sellDirectly(terminal, <ResourceConstant>resource, 1000);
						} else {
							Overmind.tradeNetwork.sell(terminal, <ResourceConstant>resource, 10000);
						}
					}
				}
			}
		}
	}

	// private sendExcessEnergy(terminal: StructureTerminal): void {
	// 	let {sendSize, inThreshold, outThreshold, equilibrium} = Energetics.settings.terminal.energy;
	// 	// See if there are any rooms actively needing energy first
	// 	let needyTerminals = _.filter(this.terminals, t =>
	// 		t != terminal && this.terminalNeedsEnergy(t) && !this.alreadyReceived.includes(t));
	// 	if (needyTerminals.length > 0) {
	// 		// Send to the most cost-efficient needy terminal
	// 		let bestTerminal = minBy(needyTerminals, (receiver: StructureTerminal) =>
	// 			Game.market.calcTransactionCost(sendSize, terminal.room.name, receiver.room.name));
	// 		if (bestTerminal) this.transferEnergy(terminal, bestTerminal);
	// 	} else {
	// 		// Send to the terminal with least energy that is not already trying to get rid of stuff
	// 		let okTerminals = _.filter(this.terminals, t =>
	// 			t != terminal && t.store.energy < outThreshold - sendSize && !this.alreadyReceived.includes(t));
	// 		let bestTerminal = minBy(okTerminals, (receiver: StructureTerminal) => this.energyInRoom(receiver.room));
	// 		if (bestTerminal) this.transferEnergy(terminal, bestTerminal);
	// 	}
	// }

	private equalize(resourceType: ResourceConstant, terminals = this.terminals): void {
		let averageAmount = _.sum(_.map(terminals,
										terminal => (colonyOf(terminal).assets[resourceType] || 0))) / terminals.length;
		let terminalsByResource = _.sortBy(terminals, terminal => (colonyOf(terminal).assets[resourceType] || 0));
		// Min-max match terminals
		let receivers = _.take(terminalsByResource, Math.floor(terminalsByResource.length / 2));
		terminalsByResource.reverse();
		let senders = _.take(terminalsByResource, Math.floor(terminalsByResource.length / 2));
		for (let [sender, receiver] of _.zip(senders, receivers)) {
			let senderAmount = colonyOf(sender).assets[resourceType] || 0;
			let receiverAmount = colonyOf(receiver).assets[resourceType] || 0;
			let tolerance = this.settings.equalize.tolerance[resourceType] || this.settings.equalize.tolerance.default;
			if (senderAmount - receiverAmount < tolerance) {
				continue; // skip if colonies are close to equilibrium
			}
			let senderSurplus = senderAmount - averageAmount;
			let receiverDeficit = averageAmount - receiverAmount;
			let sendAmount = Math.min(senderSurplus, receiverDeficit, this.settings.equalize.maxSendSize);
			sendAmount = Math.floor(Math.max(sendAmount, 0));
			let sendCost = Game.market.calcTransactionCost(sendAmount, sender.room.name, receiver.room.name);
			sendAmount = Math.min(sendAmount, (sender.store[resourceType] || 0) - sendCost - 10,
								  (receiver.storeCapacity - _.sum(receiver.store)));
			if (sendAmount < TERMINAL_MIN_SEND) {
				continue;
			}
			this.transfer(sender, receiver, resourceType, sendAmount);
		}
	}

	private equalizeCycle(): void {
		// Equalize current resource type
		this.equalize(RESOURCES_ALL[this.memory.equalizeIndex]);
		// Determine next resource type to equalize; most recent resourceType gets cycled to end
		let resourceEqualizeOrder = RESOURCES_ALL.slice(this.memory.equalizeIndex + 1)
												 .concat(RESOURCES_ALL.slice(0, this.memory.equalizeIndex + 1));
		let nextResourceType = _.find(resourceEqualizeOrder, resourceType =>
			this.assets[resourceType] > this.settings.equalize.tolerance.default);
		// Set next equalize resource index
		this.memory.equalizeIndex = _.findIndex(RESOURCES_ALL, resource => resource == nextResourceType);
	}

	// private evacuateResources(sender: StructureTerminal): void {
	// 	let receiver = _.first(_.sortBy(this.terminals, t => _.sum(t.store)));
	// 	for (let resource of RESOURCE_IMPORTANCE) {
	// 		let amount = (sender.store[resource] || 0);
	// 		if (resource == RESOURCE_ENERGY) {
	// 			amount -= Energetics.settings.terminal.energy.inThreshold; // leave this amount as reserve
	// 			if (this.averageFullness > 0.9) {
	// 				return; // ignore sending energy if other terminals are already pretty full
	// 			}
	// 			amount -= Game.market.calcTransactionCost(amount, sender.room.name, receiver.room.name) + 100;
	// 		}
	// 		if (amount > TERMINAL_MIN_SEND) {
	// 			// Send to the emptiest terminal in the network
	// 			if (receiver && receiver.storeCapacity - _.sum(receiver.store) > amount) {
	// 				this.transfer(sender, receiver, resource, amount);
	// 				return;
	// 			}
	// 		}
	// 	}
	// }

	registerTerminalState(terminal: StructureTerminal, state: TerminalState): void {
		this.exceptionTerminals[terminal.ref] = state;
		_.remove(this.terminals, t => t.ref == terminal.ref);
	}

	/* Maintains a constant restricted store of resources */
	private handleTerminalState(terminal: StructureTerminal, state: TerminalState): void {
		for (let resourceType of RESOURCE_IMPORTANCE) {
			let amount = (terminal.store[resourceType] || 0);
			let targetAmount = state.amounts[resourceType] || 0;
			// Send excess resources away to other colony
			if (amount > targetAmount + state.tolerance) {
				if (terminal.cooldown > 0) {
					continue;
				}
				let receiver = minBy(this.terminals, t => _.sum(t.store));
				let sendAmount: number;
				if (resourceType == RESOURCE_ENERGY) {
					let cost = Game.market.calcTransactionCost(amount, terminal.room.name, receiver.room.name);
					sendAmount = minMax(amount - targetAmount - cost, TERMINAL_MIN_SEND,
																	  this.settings.equalize.maxSendSize);
				} else {
					sendAmount = minMax(amount - targetAmount, TERMINAL_MIN_SEND,
															   this.settings.equalize.maxSendSize);
				}
				if (receiver && receiver.storeCapacity - _.sum(receiver.store) > sendAmount) {
					this.transfer(terminal, receiver, resourceType, sendAmount);
					return;
				}
			}
			// Request needed resources from most plentiful colony
			else if (amount < targetAmount - state.tolerance) {
				let sender = maxBy(this.readyTerminals, t => _.sum(t.store));
				let receiveAmount = minMax(targetAmount - amount, TERMINAL_MIN_SEND,
																  this.settings.equalize.maxSendSize);
				if (sender && (sender.store[resourceType] || 0) > TERMINAL_MIN_SEND) {
					this.transfer(sender, terminal, resourceType, receiveAmount);
					_.remove(this.readyTerminals, t => t.ref == sender.ref);
					return;
				}
			}
		}
	}

	// private handleAbandonedTerminals(): void {
	// 	// Send all resources to non-abandoned terminals
	// 	for (let terminal of _.filter(this.exceptionTerminals, t => t.cooldown == 0)) {
	// 		this.evacuateResources(terminal);
	// 	}
	// }

	init(): void {
		// Remove any terminals from terminal network which are in abandoning colonies
		this.assets = this.getAllAssets();
	}

	run(): void {
		// Handle terminals with special operational states
		for (let terminalID in this.exceptionTerminals) {
			this.handleTerminalState(deref(terminalID) as StructureTerminal, this.exceptionTerminals[terminalID]);
		}
		// Equalize resources
		if (Game.time % this.settings.equalize.frequency == 0) {
			this.equalize(RESOURCE_ENERGY);
		} else if (Game.time % this.settings.equalize.frequency == 20) {
			let powerTerminals = _.filter(this.terminals, t => colonyOf(t).powerSpawn != undefined);
			this.equalize(RESOURCE_POWER, powerTerminals);
		}
		// Get rid of excess resources as needed
		let terminalToSellExcess = this.terminals[Game.time % this.terminals.length];
		if (terminalToSellExcess && terminalToSellExcess.cooldown == 0) {
			this.handleExcess(terminalToSellExcess);
		}
	}

}
