import {log} from '../console/log';
import {Mem} from '../memory/Memory';
import {profile} from '../profiler/decorator';
import {Energetics} from './Energetics';
import {Colony, getAllColonies} from '../Colony';
import {maxBy, mergeSum, minBy, minMax} from '../utilities/utils';
import {RESOURCE_IMPORTANCE} from '../resources/map_resources';
import {baseStockAmounts, priorityStockAmounts, wantedStockAmounts} from '../resources/Abathur';
import {alignedNewline, bullet, rightArrow} from '../utilities/stringConstants';
import {assimilationLocked} from '../assimilation/decorator';
import {$} from '../caching/GlobalCache';

interface TerminalNetworkMemory {
	equalizeIndex: number;
}

interface TerminalNetworkStats {
	transfers: {
		[resourceType: string]: {
			[origin: string]: {
				[destination: string]: number
			}
		},
		costs: {
			[origin: string]: {
				[destination: string]: number
			}
		}
	},

}

const TerminalNetworkMemoryDefaults: TerminalNetworkMemory = {
	equalizeIndex: 0
};

const TerminalNetworkStatsDefaults: TerminalNetworkStats = {
	transfers: {
		costs: {},
	},
};

function colonyOf(terminal: StructureTerminal): Colony {
	return Overmind.colonies[terminal.room.name];
}

function wantedAmount(colony: Colony, resource: ResourceConstant): number {
	return (wantedStockAmounts[resource] || priorityStockAmounts[resource] || baseStockAmounts[resource] || 0)
		   - (colony.assets[resource] || 0);
}

@profile
@assimilationLocked
export class TerminalNetwork implements ITerminalNetwork {
	allTerminals: StructureTerminal[];				// All terminals
	terminals: StructureTerminal[];					// Terminals in standard state
	readyTerminals: StructureTerminal[];
	memory: TerminalNetworkMemory;
	stats: TerminalNetworkStats;
	exceptionTerminals: { [terminalID: string]: TerminalState }; 		// Terminals in a special operational state
	assets: { [resourceType: string]: number };		// All assets
	private notifications: string[];
	private averageFullness: number;
	private alreadyReceived: StructureTerminal[];
	private alreadySent: StructureTerminal[];
	private cache: {
		sellPrice: { [resourceType: string]: number }
	};

	static settings = {
		equalize: {
			frequency         : 2 * (TERMINAL_COOLDOWN + 1),
			maxEnergySendSize : 25000,
			maxMineralSendSize: 5000,
			tolerance         : {
				[RESOURCE_ENERGY]: 150000,
				[RESOURCE_POWER] : 2000,
				default          : 5000
			} as { [resourceType: string]: number },
			resources         : [
				RESOURCE_ENERGY,
				RESOURCE_POWER,
				RESOURCE_CATALYST,
				RESOURCE_ZYNTHIUM,
				RESOURCE_LEMERGIUM,
				RESOURCE_KEANIUM,
				RESOURCE_UTRIUM,
				RESOURCE_OXYGEN,
				RESOURCE_HYDROGEN,
			],
		}
	};

	constructor(terminals: StructureTerminal[]) {
		this.allTerminals = terminals;
		this.terminals = _.clone(terminals);
		this.readyTerminals = _.filter(terminals, t => t.cooldown == 0);
		this.memory = Mem.wrap(Memory.Overmind, 'terminalNetwork', TerminalNetworkMemoryDefaults);
		this.stats = Mem.wrap(Memory.stats.persistent, 'terminalNetwork', TerminalNetworkStatsDefaults, true);
		this.alreadyReceived = [];
		this.alreadySent = [];
		this.exceptionTerminals = {}; 		// populated in init()
		this.assets = {}; 					// populated in init()
		this.notifications = [];
		this.averageFullness = _.sum(this.terminals, t => _.sum(t.store) / t.storeCapacity) / this.terminals.length;
	}

	refresh(): void {
		$.refresh(this, 'allTerminals');
		this.terminals = _.clone(this.allTerminals);
		this.readyTerminals = _.filter(this.terminals, t => t.cooldown == 0);
		this.memory = Mem.wrap(Memory.Overmind, 'terminalNetwork', TerminalNetworkMemoryDefaults);
		this.stats = Mem.wrap(Memory.stats.persistent, 'terminalNetwork', TerminalNetworkStatsDefaults);
		this.alreadyReceived = [];
		this.alreadySent = [];
		this.exceptionTerminals = {}; 		// populated in init()
		this.assets = {}; 					// populated in init()
		this.notifications = [];
		this.averageFullness = _.sum(this.terminals, t => _.sum(t.store) / t.storeCapacity) / this.terminals.length;
	}

	/* Summarizes the total of all resources currently in a colony store structure */
	private getAllAssets(): { [resourceType: string]: number } {
		return mergeSum(_.map(this.terminals, terminal => colonyOf(terminal).assets));
	}

	private logTransfer(resourceType: ResourceConstant, amount: number, origin: string, destination: string) {
		if (!this.stats.transfers[resourceType]) this.stats.transfers[resourceType] = {};
		if (!this.stats.transfers[resourceType][origin]) this.stats.transfers[resourceType][origin] = {};
		if (!this.stats.transfers[resourceType][origin][destination]) {
			this.stats.transfers[resourceType][origin][destination] = 0;
		}
		this.stats.transfers[resourceType][origin][destination] += amount;
		this.logTransferCosts(amount, origin, destination);
	}

	private logTransferCosts(amount: number, origin: string, destination: string) {
		if (!this.stats.transfers.costs[origin]) this.stats.transfers.costs[origin] = {};
		if (!this.stats.transfers.costs[origin][destination]) this.stats.transfers.costs[origin][destination] = 0;
		let transactionCost = Game.market.calcTransactionCost(amount, origin, destination);
		this.stats.transfers.costs[origin][destination] += transactionCost;
	}

	private notify(msg: string): void {
		this.notifications.push(bullet + msg);
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
					 amount: number, description: string): number {
		let cost = Game.market.calcTransactionCost(amount, sender.room.name, receiver.room.name);
		let response = sender.send(resourceType, amount, receiver.room.name);
		if (response == OK) {
			let msg = `${sender.room.print} ${rightArrow} ${amount} ${resourceType} ${rightArrow} ` +
					  `${receiver.room.print} `;
			if (description) {
				msg += `(for ${description})`;
			}
			this.notify(msg);
			// log.info(`Sent ${amount} ${resourceType} from ${sender.room.print} to ` +
			// 		 `${receiver.room.print}. Fee: ${cost}.`);
			this.logTransfer(resourceType, amount, sender.room.name, receiver.room.name);
			this.alreadySent.push(sender);
			this.alreadyReceived.push(receiver);
			_.remove(this.readyTerminals, terminal => terminal.id == sender.id);
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
			this.transfer(sender, receiver, resourceType, amount, 'resource request');
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
						let response = Overmind.tradeNetwork.sellDirectly(terminal, RESOURCE_ENERGY, 10000);
						if (response == OK) return;
					} else if (energyOrders.length < 3) {
						let response = Overmind.tradeNetwork.sell(terminal, RESOURCE_ENERGY, 50000);
						if (response == OK) return;
					}
				}
			} else {
				if (terminal.store[<ResourceConstant>resource]! > threshold) {
					let receiver = maxBy(this.terminals,
										 terminal => wantedAmount(colonyOf(terminal),
																  <ResourceConstant>resource));
					if (receiver && wantedAmount(colonyOf(receiver), <ResourceConstant>resource) > TERMINAL_MIN_SEND) {
						// Try to send internally first
						let response = this.transfer(terminal, receiver, <ResourceConstant>resource, 1000, 'excess resources');
						if (response == OK) return;
					} else {
						// Sell excess
						if (terminalNearCapacity || terminal.store[<ResourceConstant>resource]! > 2 * threshold) {
							let response = Overmind.tradeNetwork.sellDirectly(terminal, <ResourceConstant>resource, 1000);
							if (response == OK) return;
						} else {
							let response = Overmind.tradeNetwork.sell(terminal, <ResourceConstant>resource, 10000);
							if (response == OK) return;
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

	private equalize(resourceType: ResourceConstant, terminals = this.terminals, verbose = false): void {
		log.debug(`Equalizing ${resourceType} within terminal network`);
		let maxSendSize = resourceType == RESOURCE_ENERGY ? TerminalNetwork.settings.equalize.maxEnergySendSize
														  : TerminalNetwork.settings.equalize.maxMineralSendSize;
		let averageAmount = _.sum(_.map(terminals,
										terminal => (colonyOf(terminal).assets[resourceType] || 0))) / terminals.length;
		let terminalsByResource = _.sortBy(terminals, terminal => (colonyOf(terminal).assets[resourceType] || 0));
		if (verbose) log.debug(_.map(terminalsByResource, t => `${t.room.name}: ${colonyOf(t).assets[resourceType]}`));
		// Min-max match terminals
		let receivers = _.take(terminalsByResource, Math.floor(terminalsByResource.length / 2));
		terminalsByResource.reverse();
		let senders = _.take(terminalsByResource, Math.floor(terminalsByResource.length / 2));
		if (verbose) log.debug(`Receivers: ${_.map(receivers, t => t.room.print)}`);
		if (verbose) log.debug(`Senders:   ${_.map(senders, t => t.room.print)}`);
		for (let [sender, receiver] of _.zip(senders, receivers)) {
			if (verbose) log.debug(` > ${sender.room.print} to ${receiver.room.print}...`);
			let senderAmount = colonyOf(sender).assets[resourceType] || 0;
			let receiverAmount = colonyOf(receiver).assets[resourceType] || 0;
			let tolerance = TerminalNetwork.settings.equalize.tolerance[resourceType]
							|| TerminalNetwork.settings.equalize.tolerance.default;
			if (verbose) log.debug(`    sender amt: ${senderAmount}  ` +
								   `receiver amt: ${receiverAmount}  tolerance: ${tolerance}`);
			if (senderAmount - receiverAmount < tolerance) {
				if (verbose) log.debug(`   Low tolerance`);
				continue; // skip if colonies are close to equilibrium
			}
			let senderSurplus = senderAmount - averageAmount;
			let receiverDeficit = averageAmount - receiverAmount;
			let sendAmount = Math.min(senderSurplus, receiverDeficit, maxSendSize);
			sendAmount = Math.floor(Math.max(sendAmount, 0));
			let sendCost = Game.market.calcTransactionCost(sendAmount, sender.room.name, receiver.room.name);
			sendAmount = Math.min(sendAmount, (sender.store[resourceType] || 0) - sendCost - 10,
								  (receiver.storeCapacity - _.sum(receiver.store)));
			if (sendAmount < TERMINAL_MIN_SEND) {
				if (verbose) log.debug(`    Size too small`);
				continue;
			}
			let ret = this.transfer(sender, receiver, resourceType, sendAmount, 'equalize');
			if (verbose) log.debug(`Response: ${ret}`);
		}
	}

	private equalizeCycle(): void {
		const equalizeResources = TerminalNetwork.settings.equalize.resources;
		if (this.memory.equalizeIndex >= equalizeResources.length) {
			this.memory.equalizeIndex = 0;
		}
		// Equalize current resource type
		let resource = equalizeResources[this.memory.equalizeIndex] as ResourceConstant | undefined;
		let terminals = resource == RESOURCE_POWER ? _.filter(this.terminals, t => colonyOf(t).powerSpawn != undefined)
												   : this.terminals;
		if (resource) { // resource is undefined if there is nothing to equalize
			this.equalize(resource, terminals);
		}
		// Determine next resource type to equalize; most recent resourceType gets cycled to end
		let resourceEqualizeOrder = equalizeResources.slice(this.memory.equalizeIndex + 1)
													 .concat(equalizeResources.slice(0, this.memory.equalizeIndex + 1));
		let allColonies = getAllColonies();
		let tolerance = TerminalNetwork.settings.equalize.tolerance.default;
		let nextResourceType = _.find(resourceEqualizeOrder, function (resource) {
			for (let col of allColonies) {
				if (wantedAmount(col, resource) < -1 * tolerance) { // colony has too much
					return true;
				}
			}
		});
		// Set next equalize resource index
		this.memory.equalizeIndex = _.findIndex(equalizeResources, resource => resource == nextResourceType);
	}

	registerTerminalState(terminal: StructureTerminal, state: TerminalState): void {
		this.exceptionTerminals[terminal.ref] = state;
		colonyOf(terminal).terminalState = state;
		_.remove(this.terminals, t => t.ref == terminal.ref);
	}

	/* Maintains a constant restricted store of resources */
	private handleTerminalState(terminal: StructureTerminal, state: TerminalState): void {
		for (let resourceType of RESOURCE_IMPORTANCE) {
			let maxSendSize = resourceType == RESOURCE_ENERGY ? TerminalNetwork.settings.equalize.maxEnergySendSize
															  : TerminalNetwork.settings.equalize.maxMineralSendSize;
			let amount = (terminal.store[resourceType] || 0);
			let targetAmount = state.amounts[resourceType] || 0;
			// Terminal output state - push resources away from this colony
			if (state.type == 'out') {
				if (amount > targetAmount + state.tolerance) {
					if (terminal.cooldown > 0) {
						continue;
					}
					let receiver = minBy(this.terminals, t => _.sum(t.store));
					if (!receiver) return;
					let sendAmount: number;
					if (resourceType == RESOURCE_ENERGY) {
						let cost = Game.market.calcTransactionCost(amount, terminal.room.name, receiver.room.name);
						sendAmount = minMax(amount - targetAmount - cost, TERMINAL_MIN_SEND, maxSendSize);
					} else {
						sendAmount = minMax(amount - targetAmount, TERMINAL_MIN_SEND, maxSendSize);
					}
					if (receiver && receiver.storeCapacity - _.sum(receiver.store) > sendAmount) {
						this.transfer(terminal, receiver, resourceType, sendAmount, 'exception state');
						return;
					}
				}
			}
			// Terminal input state - request resources be sent to this colony
			if (state.type == 'in') {
				if (amount < targetAmount - state.tolerance) {
					// Request needed resources from most plentiful colony
					let sender = maxBy(this.readyTerminals, t => t.store[resourceType] || 0);
					if (!sender) return;
					let receiveAmount = minMax(targetAmount - amount, TERMINAL_MIN_SEND, maxSendSize);
					if (sender && (sender.store[resourceType] || 0) > TERMINAL_MIN_SEND) {
						this.transfer(sender, terminal, resourceType, receiveAmount, 'exception state');
						_.remove(this.readyTerminals, t => t.ref == sender!.ref);
						return;
					}
				}
			}
		}
	}

	init(): void {
		this.assets = this.getAllAssets();
	}

	run(): void {
		// Handle terminals with special operational states
		for (let terminalID in this.exceptionTerminals) {
			this.handleTerminalState(deref(terminalID) as StructureTerminal, this.exceptionTerminals[terminalID]);
		}
		// Equalize resources
		if (Game.time % TerminalNetwork.settings.equalize.frequency == 0) {
			this.equalizeCycle();
		}
		// else if (Game.time % this.settings.equalize.frequency == 20) {
		// 	let powerTerminals = _.filter(this.terminals, t => colonyOf(t).powerSpawn != undefined);
		// 	this.equalize(RESOURCE_POWER, powerTerminals);
		// }
		else {
			// Get rid of excess resources as needed
			let terminalToSellExcess = this.terminals[Game.time % this.terminals.length];
			if (terminalToSellExcess && terminalToSellExcess.cooldown == 0) {
				this.handleExcess(terminalToSellExcess);
			}
		}
		// Do notifications
		if (this.notifications.length > 0) {
			log.info(`Terminal network activity: ` + alignedNewline + this.notifications.join(alignedNewline));
		}
	}

}
