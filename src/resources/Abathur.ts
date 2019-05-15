import {Colony, getAllColonies} from '../Colony';
import {maxMarketPrices, TraderJoe} from '../logistics/TradeNetwork';
import {Mem} from '../memory/Memory';
import {profile} from '../profiler/decorator';
import {mergeSum, minMax, onPublicServer} from '../utilities/utils';
import {REAGENTS} from './map_resources';

export const priorityStockAmounts: { [key: string]: number } = {
	XGHO2: 1000,	// (-70 % dmg taken)
	XLHO2: 1000, 	// (+300 % heal)
	XZHO2: 1000, 	// (+300 % fat decr - speed)
	XZH2O: 1000, 	// (+300 % dismantle)
	XKHO2: 1000, 	// (+300 % ranged attack)
	XUH2O: 1000, 	// (+300 % attack)
	GHO2 : 1000, 	// (-50 % dmg taken)
	LHO2 : 1000, 	// (+200 % heal)
	ZHO2 : 1000, 	// (+200 % fat decr - speed)
	ZH2O : 1000, 	// (+200 % dismantle)
	UH2O : 1000, 	// (+200 % attack)
	KHO2 : 1000, 	// (+200 % ranged attack)
	GO   : 1000, 	// (-30 % dmg taken)
	LO   : 1000, 	// (+100 % heal)
	ZO   : 1000, 	// (+100 % fat decr - speed)
	ZH   : 1000, 	// (+100 % dismantle)
	UH   : 1000, 	// (+100 % attack)
	KO   : 1000, 	// (+100 % ranged attack)
	G    : 2000, 	// For nukes and common compounds
};

export const wantedStockAmounts: { [key: string]: number } = {
	UH   : 3000, 	// (+100 % attack)
	KO   : 3000, 	// (+100 % ranged attack)
	XGHO2: 10000, 	// (-70 % dmg taken)
	XLHO2: 10000, 	// (+300 % heal)
	XZHO2: 6000, 	// (+300 % fat decr - speed)
	XZH2O: 6000, 	// (+300 % dismantle)
	XKHO2: 8000, 	// (+300 % ranged attack)
	XUH2O: 8000, 	// (+300 % attack)
	G    : 5000, 	// For nukes
	XLH2O: 3000, 	// (+100 % build and repair)
	LH   : 3000, 	// (+50 % build and repair)
	XUHO2: 3000, 	// (+600 % harvest)
	XKH2O: 3000, 	// (+300 % carry)
	ZK   : 800,	// intermediate
	UL   : 800,	// intermediate
	GH   : 800,	// (+50 % upgrade)
	KH   : 800,	// (+100 % carry)
	OH   : 800,	// intermediate
	GH2O : 800,	// (+80 % upgrade)
	LH2O : 800,	// (+80 % build and repair)
	KH2O : 800,	// (+200 % carry)
	XGH2O: 12000,	// (+100 % upgrade)
};

export const baseStockAmounts: { [key: string]: number } = {
	[RESOURCE_CATALYST] : 5000,
	[RESOURCE_ZYNTHIUM] : 5000,
	[RESOURCE_LEMERGIUM]: 5000,
	[RESOURCE_KEANIUM]  : 5000,
	[RESOURCE_UTRIUM]   : 5000,
	[RESOURCE_OXYGEN]   : 5000,
	[RESOURCE_HYDROGEN] : 5000
};

export interface Reaction {
	mineralType: string;
	amount: number;
}

// Compute priority and wanted stock
const _priorityStock: Reaction[] = [];
for (const resourceType in priorityStockAmounts) {
	const stock = {
		mineralType: resourceType,
		amount     : priorityStockAmounts[resourceType]
	};
	_priorityStock.push(stock);
}

const _wantedStock: Reaction[] = [];
for (const resourceType in wantedStockAmounts) {
	const stock = {
		mineralType: resourceType,
		amount     : wantedStockAmounts[resourceType]
	};
	_wantedStock.push(stock);
}

export const priorityStock = _priorityStock;
export const wantedStock = _wantedStock;

interface AbathurMemory {
	sleepUntil: number;
}

const AbathurMemoryDefaults = {
	sleepUntil: 0
};

/**
 * Abathur is responsible for the evolution of the swarm and directs global production of minerals. Abathur likes
 * efficiency, XGHO2, and high lab uptime, and dislikes pronouns.
 */
@profile
export class Abathur {

	colony: Colony;
	memory: AbathurMemory;
	priorityStock: Reaction[];
	wantedStock: Reaction[];
	assets: { [resourceType: string]: number };

	private _globalAssets: { [resourceType: string]: number };

	static settings = {
		minBatchSize: 100,	// anything less than this wastes time
		maxBatchSize: 800, 	// manager/queen carry capacity
		sleepTime   : 100,  // sleep for this many ticks once you can't make anything
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.memory = Mem.wrap(this.colony.memory, 'abathur', AbathurMemoryDefaults);
		this.priorityStock = priorityStock;
		this.wantedStock = wantedStock;
		this.assets = colony.assets;
	}

	refresh() {
		this.memory = Mem.wrap(this.colony.memory, 'abathur', AbathurMemoryDefaults);
		this.assets = this.colony.assets;
	}

	/**
	 * Summarizes the total of all resources currently in a colony store structure
	 */
	private computeGlobalAssets(): { [resourceType: string]: number } {
		const colonyAssets: { [resourceType: string]: number }[] = [];
		for (const colony of getAllColonies()) {
			colonyAssets.push(colony.assets);
		}
		return mergeSum(colonyAssets);
	}

	get globalAssets(): { [resourceType: string]: number } {
		if (!this._globalAssets) {
			this._globalAssets = this.computeGlobalAssets();
		}
		return this._globalAssets;
	}

	private canReceiveBasicMineralsForReaction(mineralQuantities: { [resourceType: string]: number },
											   amount: number): boolean {
		for (const mineral in mineralQuantities) {
			if (!this.someColonyHasExcess(<ResourceConstant>mineral, mineralQuantities[mineral])) {
				return false;
			}
		}
		return true;
	}


	private canBuyBasicMineralsForReaction(mineralQuantities: { [resourceType: string]: number }): boolean {
		if (Game.market.credits < TraderJoe.settings.market.reserveCredits) {
			return false;
		}
		for (const mineral in mineralQuantities) {
			let maxPrice = maxMarketPrices[mineral] || maxMarketPrices.default;
			if (!onPublicServer()) {
				maxPrice = Infinity;
			}
			if (Overmind.tradeNetwork.priceOf(<ResourceConstant>mineral) > maxPrice) {
				return false;
			}
		}
		return true;
	}

	static stockAmount(resource: ResourceConstant): number {
		return (wantedStockAmounts[resource] || priorityStockAmounts[resource] || baseStockAmounts[resource] || 0);
	}

	private hasExcess(mineralType: ResourceConstant, excessAmount = 0): boolean {
		return this.assets[mineralType] - excessAmount > Abathur.stockAmount(mineralType);
	}

	private someColonyHasExcess(mineralType: ResourceConstant, excessAmount = 0): boolean {
		return _.any(getAllColonies(), colony => colony.abathur.hasExcess(mineralType, excessAmount));
	}

	/**
	 * Generate a queue of reactions to produce the most needed compound
	 */
	getReactionQueue(verbose = false): Reaction[] {
		// Return nothing if you are sleeping; prevents wasteful reaction queue calculations
		if (Game.time < this.memory.sleepUntil) {
			return [];
		}
		// Compute the reaction queue for the highest priority item that you should be and can be making
		const stocksToCheck = [priorityStockAmounts, wantedStockAmounts];
		for (const stocks of stocksToCheck) {
			for (const resourceType in stocks) {
				const amountOwned = this.assets[resourceType] || 0;
				const amountNeeded = stocks[resourceType];
				if (amountOwned < amountNeeded) { // if there is a shortage of this resource
					const reactionQueue = this.buildReactionQueue(<ResourceConstant>resourceType,
																amountNeeded - amountOwned, verbose);

					const missingBaseMinerals = this.getMissingBasicMinerals(reactionQueue);
					if (!_.any(missingBaseMinerals)
						|| this.canReceiveBasicMineralsForReaction(missingBaseMinerals, amountNeeded + 1000)
						|| this.canBuyBasicMineralsForReaction(missingBaseMinerals)) {
						return reactionQueue;
					} else {
						if (verbose) console.log(`Missing minerals for ${resourceType}: ${JSON.stringify(missingBaseMinerals)}`);
					}
				}
			}
		}
		// If there's nothing you can make, sleep for 100 ticks
		this.memory.sleepUntil = Game.time + Abathur.settings.sleepTime;
		return [];
	}

	/**
	 * Build a reaction queue for a target compound
	 */
	private buildReactionQueue(mineral: ResourceConstant, amount: number, verbose = false): Reaction[] {
		amount = minMax(amount, Abathur.settings.minBatchSize, Abathur.settings.maxBatchSize);
		if (verbose) console.log(`Abathur@${this.colony.room.print}: building reaction queue for ${amount} ${mineral}`);
		let reactionQueue: Reaction[] = [];
		for (const ingredient of this.ingredientsList(mineral)) {
			let productionAmount = amount;
			if (ingredient != mineral) {
				if (verbose) console.log(`productionAmount: ${productionAmount}, assets: ${this.assets[ingredient]}`);
				productionAmount = Math.max(productionAmount - (this.assets[ingredient] || 0), 0);
			}
			productionAmount = Math.min(productionAmount, Abathur.settings.maxBatchSize);
			reactionQueue.push({mineralType: ingredient, amount: productionAmount});
		}
		if (verbose) console.log(`Pre-trim queue: ${JSON.stringify(reactionQueue)}`);
		reactionQueue = this.trimReactionQueue(reactionQueue);
		if (verbose) console.log(`Post-trim queue: ${JSON.stringify(reactionQueue)}`);
		reactionQueue = _.filter(reactionQueue, rxn => rxn.amount > 0);
		if (verbose) console.log(`Final queue: ${JSON.stringify(reactionQueue)}`);
		return reactionQueue;
	}

	/**
	 * Trim a reaction queue, reducing the amounts of precursor compounds which need to be produced
	 */
	private trimReactionQueue(reactionQueue: Reaction[]): Reaction[] {
		// Scan backwards through the queue and reduce the production amount of subsequently baser resources as needed
		reactionQueue.reverse();
		for (const reaction of reactionQueue) {
			const [ing1, ing2] = REAGENTS[reaction.mineralType];
			const precursor1 = _.findIndex(reactionQueue, rxn => rxn.mineralType == ing1);
			const precursor2 = _.findIndex(reactionQueue, rxn => rxn.mineralType == ing2);
			for (const index of [precursor1, precursor2]) {
				if (index != -1) {
					if (reactionQueue[index].amount == 0) {
						reactionQueue[index].amount = 0;
					} else {
						reactionQueue[index].amount = minMax(reaction.amount, Abathur.settings.minBatchSize,
															 reactionQueue[index].amount);
					}
				}
			}
		}
		reactionQueue.reverse();
		return reactionQueue;
	}

	/**
	 * Figure out which basic minerals are missing and how much
	 */
	getMissingBasicMinerals(reactionQueue: Reaction[], verbose = false): { [resourceType: string]: number } {
		const requiredBasicMinerals = this.getRequiredBasicMinerals(reactionQueue);
		if (verbose) console.log(`Required basic minerals: ${JSON.stringify(requiredBasicMinerals)}`);
		if (verbose) console.log(`assets: ${JSON.stringify(this.assets)}`);
		const missingBasicMinerals: { [resourceType: string]: number } = {};
		for (const mineralType in requiredBasicMinerals) {
			const amountMissing = requiredBasicMinerals[mineralType] - (this.assets[mineralType] || 0);
			if (amountMissing > 0) {
				missingBasicMinerals[mineralType] = amountMissing;
			}
		}
		if (verbose) console.log(`Missing basic minerals: ${JSON.stringify(missingBasicMinerals)}`);
		return missingBasicMinerals;
	}

	/**
	 * Get the required amount of basic minerals for a reaction queue
	 */
	private getRequiredBasicMinerals(reactionQueue: Reaction[]): { [resourceType: string]: number } {
		const requiredBasicMinerals: { [resourceType: string]: number } = {
			[RESOURCE_HYDROGEN] : 0,
			[RESOURCE_OXYGEN]   : 0,
			[RESOURCE_UTRIUM]   : 0,
			[RESOURCE_KEANIUM]  : 0,
			[RESOURCE_LEMERGIUM]: 0,
			[RESOURCE_ZYNTHIUM] : 0,
			[RESOURCE_CATALYST] : 0,
		};
		for (const reaction of reactionQueue) {
			const ingredients = REAGENTS[reaction.mineralType];
			for (const ingredient of ingredients) {
				if (!REAGENTS[ingredient]) { // resource is base mineral
					requiredBasicMinerals[ingredient] += reaction.amount;
				}
			}
		}
		return requiredBasicMinerals;
	}

	/**
	 * Recursively generate a list of ingredients required to produce a compound
	 */
	private ingredientsList(mineral: ResourceConstant): ResourceConstant[] {
		if (!REAGENTS[mineral] || _.isEmpty(mineral)) {
			return [];
		} else {
			return this.ingredientsList(REAGENTS[mineral][0])
					   .concat(this.ingredientsList(REAGENTS[mineral][1]),
							   mineral);
		}
	}

}
