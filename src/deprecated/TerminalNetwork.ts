import {assimilationLocked} from '../assimilation/decorator';
import {$} from '../caching/GlobalCache';
import {Colony, getAllColonies} from '../Colony';
import {log} from '../console/log';
import {Energetics} from '../logistics/Energetics';
import {TraderJoe} from '../logistics/TradeNetwork';
import {Mem} from '../memory/Memory';
import {profile} from '../profiler/decorator';
import {RESOURCE_IMPORTANCE} from '../resources/map_resources';
import {alignedNewline, bullet, rightArrow} from '../utilities/stringConstants';
import {cyclicListPermutation, maxBy, mergeSum, minBy, minMax} from '../utilities/utils';

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
	};

}

const getDefaultTerminalNetworkMemory: () => TerminalNetworkMemory = () => ({
	equalizeIndex: 0
});

const getDefaultTerminalNetworkStats: () => TerminalNetworkStats = () => ({
	transfers: {
		costs: {},
	},
});

function colonyOf(terminal: StructureTerminal): Colony {
	return Overmind.colonies[terminal.room.name];
}

function wantedAmount(colony: Colony, resource: ResourceConstant): number {
	return 0; // Abathur.stockAmount(resource) - (colony.assets[resource] || 0);
}

interface TerminalState {
	name: string;
	type: 'in' | 'out' | 'in/out';
	amounts: { [resourceType: string]: number };
	tolerance: number;
}


/**
 * The terminal network controls inter-colony resource transfers and requests, equalizing resources between rooms and
 * responding to on-demand resource requests
 *
 * NOTE: THIS VERSION OF THE TERMINAL NETWORK IS NOW DEPRECATED
 */
@profile
@assimilationLocked
export class TerminalNetwork /*implements ITerminalNetwork*/ {
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
		equalize          : {
			frequency            : 2 * (TERMINAL_COOLDOWN + 1),
			maxEnergySendAmount  : 25000,
			maxResourceSendAmount: 5000,
			tolerance            : {
				[RESOURCE_ENERGY]: 100000,
				[RESOURCE_POWER] : 2000,
				default          : 5000
			} as { [resourceType: string]: number },
			resources            : [
				RESOURCE_ENERGY,
				RESOURCE_POWER,
				RESOURCE_CATALYST,
				RESOURCE_ZYNTHIUM,
				RESOURCE_LEMERGIUM,
				RESOURCE_KEANIUM,
				RESOURCE_UTRIUM,
				RESOURCE_OXYGEN,
				RESOURCE_HYDROGEN,
				RESOURCE_OPS,
			],
		},
		buyEnergyThreshold: 200000, // buy energy off market if average amount is less than this
	};

	constructor(terminals: StructureTerminal[]) {
		this.allTerminals = terminals;
		this.terminals = _.clone(terminals);
		this.readyTerminals = _.filter(terminals, t => t.cooldown == 0);
		this.memory = Mem.wrap(Memory.Overmind, 'terminalNetwork', getDefaultTerminalNetworkMemory);
		this.stats = Mem.wrap(Memory.stats.persistent, 'terminalNetwork', getDefaultTerminalNetworkStats);
		this.alreadyReceived = [];
		this.alreadySent = [];
		this.exceptionTerminals = {}; 		// populated in init()
		this.assets = {}; 					// populated in init()
		this.notifications = [];
		this.averageFullness = _.sum(this.terminals, t => t.store.getUsedCapacity() / t.store.getCapacity()) / this.terminals.length;
	}

	refresh(): void {
		$.refresh(this, 'allTerminals');
		this.terminals = _.clone(this.allTerminals);
		this.readyTerminals = _.filter(this.terminals, t => t.cooldown == 0);
		this.memory = Mem.wrap(Memory.Overmind, 'terminalNetwork', getDefaultTerminalNetworkMemory);
		this.stats = Mem.wrap(Memory.stats.persistent, 'terminalNetwork', getDefaultTerminalNetworkStats);
		this.alreadyReceived = [];
		this.alreadySent = [];
		this.exceptionTerminals = {}; 		// populated in init()
		this.assets = {}; 					// populated in init()
		this.notifications = [];
		this.averageFullness = _.sum(this.terminals, t => t.store.getUsedCapacity() / t.store.getCapacity()) / this.terminals.length;
	}

	/* Summarizes the total of all resources currently in a colony store structure */
	private getAllAssets(): { [resourceType: string]: number } {
		const p = <StoreContents[]>_.map(this.terminals, terminal => (!!colonyOf(terminal) ? colonyOf(terminal).assets : {}));
		return mergeSum(...p);
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
		const transactionCost = Game.market.calcTransactionCost(amount, origin, destination);
		this.stats.transfers.costs[origin][destination] += transactionCost;
	}

	private notify(msg: string): void {
		this.notifications.push(bullet + msg);
	}

	/**
	 * Whether the terminal is actively requesting energy
	 */
	private terminalNeedsEnergy(terminal: StructureTerminal): boolean {
		return terminal.energy < Energetics.settings.terminal.energy.inThreshold;
	}

	/**
	 * Amount of space available in storage and terminal
	 */
	private remainingRoomCapacity(room: Room): number {
		let remainingCapacity = 0;
		if (room.storage) {
			remainingCapacity += room.storage.store.getFreeCapacity();
		}
		if (room.terminal) {
			remainingCapacity += room.terminal.store.getFreeCapacity();
		}
		return remainingCapacity;
	}

	/**
	 * Amount of energy in storage and terminal
	 */
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

	/**
	 * Transfer resources from one terminal to another, logging the results
	 */
	private transfer(sender: StructureTerminal, receiver: StructureTerminal, resourceType: ResourceConstant,
					 amount: number, description: string): number {
		const cost = Game.market.calcTransactionCost(amount, sender.room.name, receiver.room.name);
		const response = sender.send(resourceType, amount, receiver.room.name);
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

	/**
	 * Request resources from the terminal network, purchasing from market if unavailable and allowable
	 */
	requestResource(receiver: StructureTerminal, resourceType: ResourceConstant, amount: number,
					allowBuy = true, minDifference = 4000): void {
		if (this.exceptionTerminals[receiver.ref]) {
			return; // don't send to abandoning terminals
		}
		amount = Math.max(amount, TERMINAL_MIN_SEND);
		const possibleSenders = _.filter(this.terminals,
										 terminal => (terminal.store[resourceType] || 0) > amount + minDifference &&
													 terminal.cooldown == 0 && !this.alreadySent.includes(terminal) &&
													 terminal.id != receiver.id);
		const sender: StructureTerminal | undefined = maxBy(possibleSenders, t => (t.store[resourceType] || 0));
		if (sender) {
			this.transfer(sender, receiver, resourceType, amount, 'resource request');
		} else if (allowBuy) {
			Overmind.tradeNetwork.buy(receiver, resourceType, amount);
		}
	}

	/**
	 * Sell excess minerals on the market
	 */
	private handleExcess(terminal: StructureTerminal, threshold = 35000): void {

		const terminalNearCapacity = terminal.store.getUsedCapacity() > 0.95 * terminal.store.getCapacity();

		for (const resource in terminal.store) {
			if (resource == RESOURCE_POWER) {
				continue;
			}
			if (resource == RESOURCE_ENERGY) {

				let energyThreshold = Energetics.settings.terminal.energy.outThreshold;
				if (terminalNearCapacity) { // if you're close to full, be more aggressive with selling energy
					energyThreshold = Energetics.settings.terminal.energy.equilibrium
									  + Energetics.settings.terminal.energy.tolerance;
				}
				const amount = Energetics.settings.terminal.energy.tradeAmount;
				if (terminal.store[RESOURCE_ENERGY] > energyThreshold) {
					// don't do anything if you have storage that is below energy cap and energy can be moved there
					const storage = colonyOf(terminal).storage;
					const storageEnergyCap = Energetics.settings.storage.total.cap;
					if (!storage || storage.energy >= storageEnergyCap) {
						const ret = Overmind.tradeNetwork.sell(terminal, RESOURCE_ENERGY, amount,
															   {preferDirect: terminalNearCapacity});
						if (ret == OK) return;
					}
				}

			} else {
				if (terminal.store[<ResourceConstant>resource] > threshold) {
					const receiver = maxBy(this.terminals,
										   terminal => wantedAmount(colonyOf(terminal),
																	<ResourceConstant>resource));
					if (receiver && wantedAmount(colonyOf(receiver), <ResourceConstant>resource) > TERMINAL_MIN_SEND) {
						// Try to send internally first
						const response = this.transfer(terminal, receiver, <ResourceConstant>resource, 1000, 'excess resources');
						if (response == OK) return;
					} else {
						// Sell excess
						if (terminalNearCapacity || terminal.store[<ResourceConstant>resource]! > 2 * threshold) {
							const response = Overmind.tradeNetwork.sell(terminal, <ResourceConstant>resource, 1000,
																		{preferDirect: true});
							if (response == OK) return;
						} else {
							const response = Overmind.tradeNetwork.sell(terminal, <ResourceConstant>resource, 10000);
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

	/**
	 * Equalize resource amounts of each type through all non-exceptional terminals in the network
	 */
	private equalize(resourceType: ResourceConstant, terminals = this.terminals, verbose = false): void {

		log.debug(`Equalizing ${resourceType} within terminal network`);
		const maxSendSize = resourceType == RESOURCE_ENERGY ? TerminalNetwork.settings.equalize.maxEnergySendAmount
															: TerminalNetwork.settings.equalize.maxResourceSendAmount;
		const averageAmount = _.sum(_.map(terminals,
										  terminal => (colonyOf(terminal).assets[resourceType] || 0))) / terminals.length;

		const terminalsByResource = _.sortBy(terminals, terminal => (colonyOf(terminal).assets[resourceType] || 0));
		if (verbose) log.debug(_.map(terminalsByResource, t => `${t.room.name}: ${colonyOf(t).assets[resourceType]}`));
		// Min-max match terminals
		const receivers = _.take(terminalsByResource, Math.floor(terminalsByResource.length / 2));
		terminalsByResource.reverse();

		const senders = _.take(terminalsByResource, Math.floor(terminalsByResource.length / 2));
		if (verbose) log.debug(`Receivers: ${_.map(receivers, t => t.room.print)}`);
		if (verbose) log.debug(`Senders:   ${_.map(senders, t => t.room.print)}`);

		for (const [sender, receiver] of _.zip(senders, receivers)) {
			if (verbose) log.debug(` > ${sender.room.print} to ${receiver.room.print}...`);
			const senderAmount = colonyOf(sender).assets[resourceType] || 0;
			const receiverAmount = colonyOf(receiver).assets[resourceType] || 0;
			const tolerance = TerminalNetwork.settings.equalize.tolerance[resourceType]
							  || TerminalNetwork.settings.equalize.tolerance.default;
			if (verbose) {
				log.debug(`    sender amt: ${senderAmount}  receiver amt: ${receiverAmount}  tolerance: ${tolerance}`);
			}
			if (senderAmount - receiverAmount < tolerance
				&& receiverAmount > Energetics.settings.terminal.energy.inThreshold) {
				if (verbose) log.debug(`   Low tolerance`);
				continue; // skip if colonies are close to equilibrium
			}

			const senderSurplus = senderAmount - averageAmount;
			const receiverDeficit = averageAmount - receiverAmount;

			let sendAmount = Math.min(senderSurplus, receiverDeficit, maxSendSize);
			sendAmount = Math.floor(Math.max(sendAmount, 0));
			const sendCost = Game.market.calcTransactionCost(sendAmount, sender.room.name, receiver.room.name);
			sendAmount = Math.min(sendAmount, (sender.store[resourceType] || 0) - sendCost - 10,
								  (receiver.store.getFreeCapacity()));

			if (sendAmount < TERMINAL_MIN_SEND) {
				if (verbose) log.debug(`    Size too small`);
				continue;
			}
			const ret = this.transfer(sender, receiver, resourceType, sendAmount, 'equalize');
			if (verbose) log.debug(`Response: ${ret}`);
		}
	}

	private equalizeCycle(): void {
		const equalizeResources = TerminalNetwork.settings.equalize.resources;
		if (this.memory.equalizeIndex >= equalizeResources.length) {
			this.memory.equalizeIndex = 0;
		}
		// Equalize current resource type
		const resource = equalizeResources[this.memory.equalizeIndex] as ResourceConstant | undefined;
		const terminals = resource == RESOURCE_POWER ? _.filter(this.terminals, t => colonyOf(t).powerSpawn != undefined)
													 : this.terminals;
		if (resource) { // resource is undefined if there is nothing to equalize
			this.equalize(resource, terminals);
		}
		// Determine next resource type to equalize; most recent resourceType gets cycled to end
		const resourceEqualizeOrder = cyclicListPermutation(equalizeResources, this.memory.equalizeIndex + 1);
		const allColonies = getAllColonies();
		const nextResourceType = _.find(resourceEqualizeOrder, resource => {
			if (resource == RESOURCE_ENERGY) {
				return true;
			}
			const amounts = _.map(this.terminals, terminal => colonyOf(terminal).assets[resource] || 0);
			const tolerance = TerminalNetwork.settings.equalize.tolerance[resource]
							  || TerminalNetwork.settings.equalize.tolerance.default;
			return _.max(amounts) - _.min(amounts) > tolerance;
		});
		// Set next equalize resource index
		this.memory.equalizeIndex = _.findIndex(equalizeResources, resource => resource == nextResourceType);
	}

	/**
	 * Register a terminal to be placed in an exceptional state
	 */
	registerTerminalState(terminal: StructureTerminal, state: TerminalState): void {
		this.exceptionTerminals[terminal.ref] = state;
		// colonyOf(terminal).terminalState = state;
		_.remove(this.terminals, t => t.id == terminal.id);
	}

	/**
	 * Handles exceptional terminal states
	 */
	private handleTerminalState(terminal: StructureTerminal, state: TerminalState): void {
		for (const resource of RESOURCE_IMPORTANCE) {
			const maxSendSize = resource == RESOURCE_ENERGY ? TerminalNetwork.settings.equalize.maxEnergySendAmount
															: TerminalNetwork.settings.equalize.maxResourceSendAmount;
			const amount = (terminal.store[resource] || 0);
			const targetAmount = state.amounts[resource] || 0;
			const tolerance = targetAmount == 0 ? TERMINAL_MIN_SEND : state.tolerance;
			// Terminal input state - request resources be sent to this colony
			if (state.type == 'in' || state.type == 'in/out') {
				if (amount < targetAmount - tolerance) {
					// Request needed resources from most plentiful colony
					const sender = maxBy(this.readyTerminals, t => t.store[resource] || 0);
					if (sender) {
						const receiveAmount = minMax(targetAmount - amount, TERMINAL_MIN_SEND, maxSendSize);
						if ((sender.store[resource] || 0) > TERMINAL_MIN_SEND) {
							this.transfer(sender, terminal, resource, receiveAmount, 'exception state in');
							_.remove(this.readyTerminals, t => t.ref == sender!.ref);
						}
					}
				}
			}
			// Terminal output state - push resources away from this colony
			if (state.type == 'out' || state.type == 'in/out') {
				if (terminal.cooldown == 0 && amount > targetAmount + tolerance) {
					const receiver = minBy(this.terminals, t => t.store.getUsedCapacity());
					if (receiver) {
						let sendAmount: number;
						if (resource == RESOURCE_ENERGY) {
							const cost = Game.market.calcTransactionCost(amount, terminal.room.name, receiver.room.name);
							sendAmount = minMax(amount - targetAmount - cost, TERMINAL_MIN_SEND, maxSendSize);
						} else {
							sendAmount = minMax(amount - targetAmount, TERMINAL_MIN_SEND, maxSendSize);
						}
						if (receiver.store.getFreeCapacity() >= sendAmount) {
							this.transfer(terminal, receiver, resource, sendAmount, 'exception state out');
							return;
						}
					}

				}
			}
		}
	}

	addStore(store: { [resourceType: string]: number }, storeToAdd: StoreDefinition) {
		_.keys(storeToAdd).forEach(resType => {
			const resourceType = resType as ResourceConstant;
			if (store[resType]) {
				store[resType] += storeToAdd[resourceType] || 0;
			} else {
				store[resType] = storeToAdd[resourceType] || 0;
			}
		});
	}

	handleOverflowWithNoEnergy() {
		for (const terminal of this.terminals) {
			if (terminal.store.getFreeCapacity() < 5000 && terminal.store[RESOURCE_ENERGY] < 10000) {
				const roomOrders = _.filter(Game.market.orders, order => order.roomName == terminal.room.name);
				for (const res in terminal.store) {
					const quantity = terminal.store[res as ResourceConstant];
					if (quantity > 15000 && roomOrders.filter(order => order.resourceType == res).length == 0) {
						log.info(`Creating sell order for ${res} in room ${terminal.room.print}`);
						Overmind.tradeNetwork.sell(terminal, res as ResourceConstant, 2000);
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
		for (const terminalID in this.exceptionTerminals) {
			this.handleTerminalState(deref(terminalID) as StructureTerminal, this.exceptionTerminals[terminalID]);
		}
		// Equalize resources
		if (Game.time % TerminalNetwork.settings.equalize.frequency == 0) {
			this.equalizeCycle();
			this.handleOverflowWithNoEnergy();
		}
		// else if (Game.time % this.settings.equalize.frequency == 20) {
		// 	let powerTerminals = _.filter(this.terminals, t => colonyOf(t).powerSpawn != undefined);
		// 	this.equalize(RESOURCE_POWER, powerTerminals);
		// }
		else {
			// Get rid of excess resources as needed
			const terminalToSellExcess = this.terminals[Game.time % this.terminals.length];
			if (terminalToSellExcess && terminalToSellExcess.cooldown == 0) {
				this.handleExcess(terminalToSellExcess);
			}
			// Order more energy if needed
			if (Game.market.credits > TraderJoe.settings.market.credits.canBuyEnergyAbove) {
				const averageEnergy = _.sum(this.terminals, terminal => colonyOf(terminal).assets[RESOURCE_ENERGY] || 0)
									  / this.terminals.length;
				if (averageEnergy < TerminalNetwork.settings.buyEnergyThreshold) {
					const poorestTerminal = minBy(this.terminals,
												  terminal => colonyOf(terminal).assets[RESOURCE_ENERGY] || 0);
					if (poorestTerminal) {
						const amount = Energetics.settings.terminal.energy.tradeAmount;
						Overmind.tradeNetwork.buy(poorestTerminal, RESOURCE_ENERGY, amount, {preferDirect: false});
					}
				}
			}

		}
		// Do notifications
		if (this.notifications.length > 0) {
			log.info(`Terminal network activity: ` + alignedNewline + this.notifications.join(alignedNewline));
		}
		// this.shareRooms();
	}

}
