import {assimilationLocked} from '../assimilation/decorator';
import {Colony} from '../Colony';
import {log} from '../console/log';
import {Mem} from '../memory/Memory';
import {profile} from '../profiler/decorator';
import {Abathur} from '../resources/Abathur';
import {ALL_ZERO_ASSETS} from '../resources/map_resources';
import {alignedNewline, bullet, rightArrow} from '../utilities/stringConstants';
import {exponentialMovingAverage, maxBy, mergeSum, minBy} from '../utilities/utils';
import {Energetics} from './Energetics';
import {MAX_ENERGY_BUY_ORDERS, MAX_ENERGY_SELL_ORDERS, TraderJoe} from './TradeNetwork';

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
	avgCooldown: { // moving exponential average of cooldown - ranges from 0 to 5
		[colonyName: string]: number
	};
	overload: { // moving exponential average of (1 if terminal wants to send but can't | 0 otherwise)
		[colonyName: string]: number
	};
}

const TerminalNetworkMemoryDefaults: TerminalNetworkMemory = {
	equalizeIndex: 0
};

const TerminalNetworkStatsDefaults: TerminalNetworkStats = {
	transfers  : {
		costs: {},
	},
	avgCooldown: {},
	overload   : {},
};


function colonyOf(terminal: StructureTerminal): Colony {
	return Overmind.colonies[terminal.room.name];
}

function wantedAmount(colony: Colony, resource: ResourceConstant): number {
	return Abathur.stockAmount(resource) - (colony.assets[resource] || 0);
}


export const enum TN_STATE {
	activeProvider   = 5, // actively offload the resource into other non-activeProvider rooms in the network
	passiveProvier   = 4, // place their resource at the disposal of the network
	equilibrium      = 3, // close to the desired amount of resource and prefer not to trade except to activeRequestors
	passiveRequestor = 2, // below target amount of resource and will receive from providers
	activeRequestor  = 1, // have an immediate need of the resource and will be filled by other non-activeRequestors
	error            = 0, // this should never be used
}

export const RESOURCE_EXCHANGE_PRIORITIES: ResourceConstant[] = [
	// TODO: fill in
];

export const SURPLUS_THRESHOLDS: { [resource: string]: number | undefined } = {
	// TODO
};


export const TARGET_THRESHOLDS: { [resource: string]: number } = { // These must add to less than terminal capacity
	// TODO
};

export const TOLERANCES: { [resource: string]: number } = {
	// TODO
};

const MIN_COLONY_SPACE = 20000; // colonies should have at least this much space in the room
const EMPTY_COLONY_TIER: { [resourceType: string]: Colony[] } = _.zipObject(RESOURCES_ALL,
																			_.map(RESOURCES_ALL, i => []));
const TERMINAL_AVERAGING_WINDOW = 1000;

/**
 * The terminal network controls inter-colony resource transfers and requests, equalizing resources between rooms and
 * responding to on-demand resource requests
 */
@profile
@assimilationLocked
export class TerminalNetworkV2 {

	private colonies: Colony[];
	private colonyThresholds: {
		[colName: string]: {
			[resourceType: string]: {
				target: number,
				surplus: number | undefined,
				tolerance: number
			}
		}
	};

	private colonyStates: { [colName: string]: { [resourceType: string]: TN_STATE } };
	private activeProviders: { [resourceType: string]: Colony[] };
	private passiveProviders: { [resourceType: string]: Colony[] };
	private equilibriumNodes: { [resourceType: string]: Colony[] };
	private passiveRequestors: { [resourceType: string]: Colony[] };
	private activeRequestors: { [resourceType: string]: Colony[] };

	private alreadySent: { [colName: string]: boolean };

	private assets: { [resourceType: string]: number };
	private notifications: string[];

	private memory: TerminalNetworkMemory;
	private stats: TerminalNetworkStats;
	private terminalOverload: { [colName: string]: boolean };

	static settings = {

		maxEnergySendSize : 25000,
		maxMineralSendSize: 5000,

		// equalize          : {
		// 	frequency         : 2 * (TERMINAL_COOLDOWN + 1),
		// 	maxEnergySendSize : 25000,
		// 	maxMineralSendSize: 5000,
		// 	tolerance         : {
		// 		[RESOURCE_ENERGY]: 100000,
		// 		[RESOURCE_POWER] : 2000,
		// 		default          : 5000
		// 	} as { [resourceType: string]: number },
		// 	resources         : [
		// 		RESOURCE_ENERGY,
		// 		RESOURCE_POWER,
		// 		RESOURCE_CATALYST,
		// 		RESOURCE_ZYNTHIUM,
		// 		RESOURCE_LEMERGIUM,
		// 		RESOURCE_KEANIUM,
		// 		RESOURCE_UTRIUM,
		// 		RESOURCE_OXYGEN,
		// 		RESOURCE_HYDROGEN,
		// 		RESOURCE_OPS,
		// 	],
		// },

		buyEnergyThreshold: 200000, // buy energy off market if average amount is less than this
	};


	constructor(terminals: StructureTerminal[]) {
		this.colonies = [];
		this.colonyThresholds = {};

		this.colonyStates = {};
		this.activeProviders = _.clone(EMPTY_COLONY_TIER);
		this.passiveProviders = _.clone(EMPTY_COLONY_TIER);
		this.equilibriumNodes = _.clone(EMPTY_COLONY_TIER);
		this.passiveRequestors = _.clone(EMPTY_COLONY_TIER);
		this.activeRequestors = _.clone(EMPTY_COLONY_TIER);

		this.alreadySent = {};

		this.assets = _.clone(ALL_ZERO_ASSETS); // populated when colonies are added
		this.memory = Mem.wrap(Memory.Overmind, 'terminalNetwork', TerminalNetworkMemoryDefaults);
		this.stats = Mem.wrap(Memory.stats.persistent, 'terminalNetwork', TerminalNetworkStatsDefaults, true);
		this.terminalOverload = {};

		this.notifications = [];
	}

	refresh(): void {
		this.memory = Mem.wrap(Memory.Overmind, 'terminalNetwork', TerminalNetworkMemoryDefaults);
		this.stats = Mem.wrap(Memory.stats.persistent, 'terminalNetwork', TerminalNetworkStatsDefaults, true);
		this.alreadySent = {};
		this.terminalOverload = {};
		this.notifications = [];
	}

	/**
	 * Adds a colony to the terminal network; should be populated following constructor() phase
	 */
	addColony(colony: Colony): void {
		if (!(colony.terminal && colony.terminal.my && colony.level >= 6)) {
			log.error(`Cannot add colony ${colony.print} to terminal network!`);
		} else {
			// Add colony to list
			this.colonies.push(colony);
			this.colonyStates[colony.name] = {};
		}
	}

	// Transfer logging and notification stuff =========================================================================

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
			this.alreadySent[sender.room.name] = true;
		} else {
			log.warning(`Could not send ${amount} ${resourceType} from ${sender.room.print} to ` +
						`${receiver.room.print}! Response: ${response}`);
			if (response == ERR_NOT_ENOUGH_RESOURCES || response == ERR_TIRED) {
				this.terminalOverload[sender.room.name] = true;
			}
		}
		return response;
	}

	/**
	 * Returns the remaining amount of capacity in a colony. Overfilled storages (from OPERATE_STORAGE) are
	 * counted as just being at 100% capacity. Optionally takes an additionalAssets argument that asks whether the
	 * colony would be near capacity if additionalAssets amount of resources were added.
	 */
	private getRemainingSpace(colony: Colony, includeFactoryCapacity = false): number {
		let totalAssets = _.sum(colony.assets);
		// Overfilled storage gets counted as just 100% full
		if (colony.storage && _.sum(colony.storage.store) > STORAGE_CAPACITY) {
			totalAssets -= (_.sum(colony.storage.store) - STORAGE_CAPACITY);
		}

		const roomCapacity = (colony.terminal ? TERMINAL_CAPACITY : 0) +
							 (colony.storage ? STORAGE_CAPACITY : 0) +
							 (colony.factory && includeFactoryCapacity ? FACTORY_CAPACITY : 0);

		return roomCapacity - totalAssets;
	}

	private getTargetThreshold(colony: Colony, resource: ResourceConstant): number {

	}

	private getSurplusThreshold(colony: Colony, resource: ResourceConstant): number | undefined {

	}

	private getTolerance(colony: Colony, resource: ResourceConstant): number {

	}

	/**
	 * Compute the default state of a colony for a given resource
	 */
	private getColonyState(colony: Colony, resource: ResourceConstant): TN_STATE {
		const surplus = SURPLUS_THRESHOLDS[resource];
		const target = TARGET_THRESHOLDS[resource];
		const tolerance = TOLERANCES[resource];
		const amount = colony.assets[resource] || 0;

		// Active provider if the room is above surplus amount or if the room is above target+tolerance and near full
		if (amount > surplus || (amount > target + tolerance && this.colonyNearCapacity(colony))) {
			return TN_STATE.activeProvider;
		}
		// Passive provider if the room has below surplus but above target+tolerance
		if (surplus >= amount && amount > target + tolerance) {
			return TN_STATE.passiveProvier;
		}
		// Equilibrium state if room has within +/- tolerance of target amount
		if (target + tolerance >= amount && amount >= Math.max(target - tolerance, 0)) {
			return TN_STATE.equilibrium;
		}
		// Passive requestor if room has below target-tolerance
		if (amount < Math.max(target - tolerance, 0)) {
			return TN_STATE.passiveRequestor;
		}
		// Active requestor if room has below target amount and there is an immediate need for the resource
		// This can only be triggered with an override from another part of the program

		// Should never reach here
		log.error(`Shouldn't reach this part of TerminalNetwork code!`);
		return 0;
	}

	/**
	 * Compute which colonies should act as active providers, passive providers, and requestors
	 */
	private assignColonyStates() {
		// Assign a state to each colony whose state isn't already specified
		for (const colony of this.colonies) {
			for (const resource of RESOURCE_EXCHANGE_PRIORITIES) {
				if (this.colonyStates[colony.name][resource] == undefined) {
					this.colonyStates[colony.name][resource] = this.getColonyState(colony, resource);
				}
				// Populate the entry in the tier lists
				switch (this.colonyStates[colony.name][resource]) {
					case TN_STATE.activeProvider:
						this.activeProviders[resource].push(colony);
						break;
					case TN_STATE.passiveProvier:
						this.passiveProviders[resource].push(colony);
						break;
					case TN_STATE.equilibrium:
						this.equilibriumNodes[resource].push(colony);
						break;
					case TN_STATE.passiveRequestor:
						this.passiveRequestors[resource].push(colony);
						break;
					case TN_STATE.activeRequestor:
						this.activeRequestors[resource].push(colony);
						break;
					case TN_STATE.error:
						log.error(`TN_STATE.error type encountered!`);
						break;
				}
			}
		}
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

						if (terminalNearCapacity) { // just get rid of stuff at high capacities
							const response = Overmind.tradeNetwork.sellDirectly(terminal, RESOURCE_ENERGY, amount, true);
							if (response == OK) return;
						} else {
							const response = Overmind.tradeNetwork.sell(terminal, RESOURCE_ENERGY, amount,
																		MAX_ENERGY_SELL_ORDERS);
							if (response == OK) return;
						}

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
							const response = Overmind.tradeNetwork.sellDirectly(terminal, <ResourceConstant>resource, 1000);
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


	/**
	 * Register a terminal to be placed in an exceptional state
	 */
	registerTerminalState(terminal: StructureTerminal, state: TerminalState): void {
		this.exceptionTerminals[terminal.ref] = state;
		colonyOf(terminal).terminalState = state;
		_.remove(this.terminals, t => t.id == terminal.id);
	}

	// /**
	//  * Handles exceptional terminal states
	//  */
	// private handleTerminalState(terminal: StructureTerminal, state: TerminalState): void {
	// 	for (const resourceType of RESOURCE_IMPORTANCE) {
	// 		const maxSendSize = resourceType == RESOURCE_ENERGY ? TerminalNetwork.settings.equalize.maxEnergySendSize
	// 															: TerminalNetwork.settings.equalize.maxMineralSendSize;
	// 		const amount = (terminal.store[resourceType] || 0);
	// 		const targetAmount = state.amounts[resourceType] || 0;
	// 		const tolerance = targetAmount == 0 ? TERMINAL_MIN_SEND : state.tolerance;
	// 		// Terminal input state - request resources be sent to this colony
	// 		if (state.type == 'in' || state.type == 'in/out') {
	// 			if (amount < targetAmount - tolerance) {
	// 				// Request needed resources from most plentiful colony
	// 				const sender = maxBy(this.readyTerminals, t => t.store[resourceType] || 0);
	// 				if (sender) {
	// 					const receiveAmount = minMax(targetAmount - amount, TERMINAL_MIN_SEND, maxSendSize);
	// 					if ((sender.store[resourceType] || 0) > TERMINAL_MIN_SEND) {
	// 						this.transfer(sender, terminal, resourceType, receiveAmount, 'exception state in');
	// 						_.remove(this.readyTerminals, t => t.ref == sender!.ref);
	// 					}
	// 				}
	// 			}
	// 		}
	// 		// Terminal output state - push resources away from this colony
	// 		if (state.type == 'out' || state.type == 'in/out') {
	// 			if (terminal.cooldown == 0 && amount > targetAmount + tolerance) {
	// 				const receiver = minBy(this.terminals, t => _.sum(t.store));
	// 				if (receiver) {
	// 					let sendAmount: number;
	// 					if (resourceType == RESOURCE_ENERGY) {
	// 						const cost = Game.market.calcTransactionCost(amount, terminal.room.name, receiver.room.name);
	// 						sendAmount = minMax(amount - targetAmount - cost, TERMINAL_MIN_SEND, maxSendSize);
	// 					} else {
	// 						sendAmount = minMax(amount - targetAmount, TERMINAL_MIN_SEND, maxSendSize);
	// 					}
	// 					if (receiver.storeCapacity - _.sum(receiver.store) > sendAmount) {
	// 						this.transfer(terminal, receiver, resourceType, sendAmount, 'exception state out');
	// 						return;
	// 					}
	// 				}
	// 			}
	// 		}
	// 	}
	// }


	// handleOverflowWithNoEnergy() {
	// 	for (const terminal of this.terminals) {
	// 		if (terminal.store.getFreeCapacity() < 5000 && terminal.store[RESOURCE_ENERGY] < 10000) {
	// 			const roomOrders = _.filter(Game.market.orders, order => order.roomName == terminal.room.name);
	// 			for (const res in terminal.store) {
	// 				const quantity = terminal.store[res as ResourceConstant];
	// 				if (quantity > 15000 && roomOrders.filter(order => order.resourceType == res).length == 0) {
	// 					log.info(`Creating sell order for ${res} in room ${terminal.room.print}`);
	// 					Overmind.tradeNetwork.sell(terminal, res as ResourceConstant, 2000);
	// 				}
	// 			}
	// 		}
	// 	}
	// }


	init(): void {
		// Update assets
		this.assets = mergeSum(_.map(this.colonies, colony => colony.assets));
	}


	private handleRequestors(requestors: { [resource: string]: Colony[] },
							 prioritizedPartners: { [resource: string]: Colony[] }[],
							 sendTargetPlusTolerance = true): void {
		for (const resource of RESOURCE_EXCHANGE_PRIORITIES) {
			for (const colony of (requestors[resource] || [])) {
				// Generate a list of partner sets by picking the appropriate resource from the prioritizedPartners
				const partnerSets: Colony[][] = _.map(prioritizedPartners, partners => partners[resource] || []);
				// Compute the request amount
				let requestAmount = this.getTargetThreshold(colony, resource) - colony.assets[resource];
				if (sendTargetPlusTolerance) {
					requestAmount += this.getTolerance(colony, resource);
				}
				const maxAmount = resource == RESOURCE_ENERGY ? TerminalNetworkV2.settings.maxEnergySendSize
															  : TerminalNetworkV2.settings.maxMineralSendSize;
				requestAmount = Math.min(requestAmount, maxAmount);

				this.handleRequestInstance(colony, resource, requestAmount, partnerSets, true);
			}
		}
	}

	private handleRequestInstance(colony: Colony, resource: ResourceConstant, requestAmount: number,
								  partnerSets: Colony[][], allowDivvying = true) {
		// Try to find the best single colony to obtain resources from
		for (const partners of partnerSets) {
			// First try to find a partner that has more resources than (target + request)
			let validPartners: Colony[] = _.filter(partners, partner =>
				partner.assets[resource] - requestAmount >= this.getTargetThreshold(partner, resource));
			// If that doesn't work, try to find a partner where assets - request > target - tolerance
			if (validPartners.length == 0) {
				validPartners = _.filter(partners, partner =>
					partner.assets[resource] - requestAmount >=
					this.getTargetThreshold(partner, resource) - this.getTolerance(colony, resource));
			}
			if (validPartners.length > 0) {
				const bestPartner = this.getBestSenderColony(resource, requestAmount, colony, validPartners);
				const sender = bestPartner.terminal!;
				const receiver = colony.terminal!;
				// Send the resources or mark the terminal as overloaded for this tick
				if (sender.cooldown == 0 && !this.alreadySent[sender.room.name]) {
					this.transfer(sender, receiver, resource, requestAmount, `active request for ${resource}`);
				} else {
					this.terminalOverload[sender.room.name] = true;
				}
				return;
			}
		}

		if (allowDivvying) {
			// If no colony is sufficient to send you the resources, try to divvy it up among several colonies
			const MAX_SEND_REQUESTS = 3;
			const allPartners = _.flatten(partnerSets) as Colony[];
			const validPartners: Colony[] = _.sortBy(
				_.filter(allPartners, partner => partner.assets[resource] > this.getTargetThreshold(partner, resource)),
				partner => partner.assets[resource] - this.getTargetThreshold(partner, resource)
			);
			// find all colonies that have more than target amt of resource and pick 3 with the most amt

			for (const partner of _.take(validPartners, MAX_SEND_REQUESTS)) {
				const sender = partner.terminal!;
				const receiver = colony.terminal!;
				// Send the resources or mark the terminal as overloaded for this tick
				if (sender.cooldown == 0 && !this.alreadySent[sender.room.name]) {
					this.transfer(sender, receiver, resource, requestAmount, `request instance for ${resource}`);
				} else {
					this.terminalOverload[sender.room.name] = true;
				}
			}
		}
	}

	/**
	 * Gets the best partner colony to send requested resources from
	 */
	private getBestSenderColony(resource: ResourceConstant, amount: number,
								colony: Colony, partners: Colony[]): Colony {
		if (partners.length == 0) {
			log.error(`Passed an empty list of sender partners!`);
		}
		const K = 1;
		const BIG_COST = 5000;
		return maxBy(partners, partner => {
			const sendCost = Game.market.calcTransactionCost(amount, partner.name, colony.name);
			const avgCooldown = this.stats.avgCooldown[partner.name];
			const score = -1 * (sendCost) * (K + sendCost / BIG_COST + avgCooldown);
			return score;
		}) as Colony;
		// TODO: add market integration to figure out when it is more effective to buy
	}

	private handleProviders(providers: { [resource: string]: Colony[] },
							prioritizedPartners: { [resource: string]: Colony[] }[]): void {
		for (const resource of RESOURCE_EXCHANGE_PRIORITIES) {
			for (const colony of (providers[resource] || [])) {
				// Skip if the terminal is on cooldown
				if (colony.terminal && colony.terminal.cooldown > 0) {
					continue;
				}
				// Skip if the terminal has already committed to sending this tick
				if (this.alreadySent[colony.name]) {
					continue;
				}
				// Generate a list of partner sets by picking the appropriate resource from the prioritizedPartners
				const partnerSets: Colony[][] = _.map(prioritizedPartners, partners => partners[resource] || []);
				// Compute the send amount
				let sendAmount = colony.assets[resource] - this.getTargetThreshold(colony, resource);
				const maxAmount = resource == RESOURCE_ENERGY ? TerminalNetworkV2.settings.maxEnergySendSize
															  : TerminalNetworkV2.settings.maxMineralSendSize;
				sendAmount = Math.min(sendAmount, maxAmount);

				this.handleProvideInstance(colony, resource, sendAmount, partnerSets);
			}
		}
	}

	private handleProvideInstance(colony: Colony, resource: ResourceConstant, sendAmount: number,
								  partnerSets: Colony[][]) {
		// Try to find the best single colony to send resources to
		for (const partners of partnerSets) {
			// First try to find a partner that has less resources than target - sendAmount and can hold more stuff
			let validPartners: Colony[] = _.filter(partners, partner =>
				partner.assets[resource] + sendAmount <= this.getTargetThreshold(partner, resource) &&
				this.getRemainingSpace(partner) - sendAmount >= MIN_COLONY_SPACE);
			// If that doesn't work, try to find a partner where assets + sendAmount < target + tolerance and has room
			if (validPartners.length == 0) {
				validPartners = _.filter(partners, partner =>
					partner.assets[resource] + sendAmount <=
					this.getTargetThreshold(partner, resource) + this.getTolerance(colony, resource) &&
					this.getRemainingSpace(partner) - sendAmount >= MIN_COLONY_SPACE);
			}
			// If that doesn't work, just try to find any room with space that won't become an activeProvider
			if (validPartners.length == 0) {
				validPartners = _.filter(partners, partner => {
					if (this.getRemainingSpace(partner) - sendAmount < MIN_COLONY_SPACE) {
						return false;
					}
					const surplusThreshold = this.getSurplusThreshold(partner, resource);
					if (surplusThreshold != undefined) {
						return partner.assets[resource] + sendAmount < surplusThreshold;
					} else {
						return partner.assets[resource] + sendAmount <=
							   this.getTargetThreshold(partner, resource) + this.getTolerance(colony, resource);
					}
				});
			}
			// If you've found partners, send it to the best one
			if (validPartners.length > 0) {
				const bestPartner = minBy(validPartners, partner =>
					Game.market.calcTransactionCost(sendAmount, colony.name, partner.name)) as Colony;
				const sender = colony.terminal!;
				const receiver = bestPartner.terminal!;
				// Send the resources or mark the terminal as overloaded for this tick
				if (sender.cooldown == 0 && !this.alreadySent[sender.room.name]) {
					this.transfer(sender, receiver, resource, sendAmount, `provide instance for ${resource}`);
				} else {
					this.terminalOverload[sender.room.name] = true;
				}
				return;
			}
		}

		// TODO: if no send target, check out market options
	}


	run(): void {
		// Assign states to each colony; manual state specification should have already been done in directive.init()
		this.assignColonyStates();

		// Handle request types by descending priority: activeRequestors -> activeProviders -> passiveRequestors
		// passiveProviders and equilibriumNodes have no action
		this.handleRequestors(this.activeRequestors, [
			this.activeProviders,
			this.passiveProviders,
			this.equilibriumNodes,
			this.passiveRequestors,
		], true);

		this.handleProviders(this.activeProviders, [
			this.activeRequestors,
			this.passiveRequestors,
			this.equilibriumNodes,
			// this.passiveProviders // maybe I should add this?
		]);

		this.handleRequestors(this.passiveRequestors, [
			this.activeProviders,
			this.passiveProviders,
		], false);


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
			if (Game.market.credits > TraderJoe.settings.market.energyCredits) {
				const averageEnergy = _.sum(this.terminals, terminal => colonyOf(terminal).assets[RESOURCE_ENERGY] || 0)
									  / this.terminals.length;
				if (averageEnergy < TerminalNetwork.settings.buyEnergyThreshold) {
					const poorestTerminal = minBy(this.terminals,
												  terminal => colonyOf(terminal).assets[RESOURCE_ENERGY] || 0);
					if (poorestTerminal) {
						const amount = Energetics.settings.terminal.energy.tradeAmount;
						Overmind.tradeNetwork.maintainBuyOrder(poorestTerminal, RESOURCE_ENERGY, amount,
															   MAX_ENERGY_BUY_ORDERS);
					}
				}
			}

		}
		// Do notifications
		if (this.notifications.length > 0) {
			log.info(`Terminal network activity: ` + alignedNewline + this.notifications.join(alignedNewline));
		}
	}

	private recordStats(): void {
		for (const colony of this.colonies) {
			if (colony.terminal) {
				this.stats.avgCooldown[colony.name] = exponentialMovingAverage(
					colony.terminal.cooldown,
					this.stats.avgCooldown[colony.name] || 0,
					TERMINAL_AVERAGING_WINDOW);
				this.stats.overload[colony.name] = exponentialMovingAverage(
					this.terminalOverload[colony.name] ? 1 : 0,
					this.stats.overload[colony.name],
					CREEP_LIFE_TIME);
			}
		}
	}

}
