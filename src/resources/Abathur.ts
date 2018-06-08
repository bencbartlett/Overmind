// Abathur is responsible for the evolution of the swarm and directs global production of minerals

import {Colony, getAllColonies} from '../Colony';
import {REAGENTS} from './map_resources';
import {mergeSum} from '../utilities/utils';

const _priorityStock: { [key: string]: number } = {
	XGHO2: 1000,	// For toughness
	XLHO2: 1000, 	// For healing
	XZHO2: 1000, 	// For speed
	XZH2O: 1000, 	// For dismantling
	XKHO2: 1000, 	// For ranged attackers
	XUH2O: 1000, 	// For attacking
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
};

const _wantedStock: { [key: string]: number } = {
	UH   : 2000, 	// (+100 % attack)
	KO   : 3000, 	// (+100 % ranged attack)
	XGHO2: 10000, 	// For toughness
	XLHO2: 10000, 	// For healing
	XZHO2: 6000, 	// For speed
	XZH2O: 6000, 	// For dismantling
	XKHO2: 8000, 	// For ranged attackers
	XUH2O: 8000, 	// For attacking
	G    : 4000, 	// For nukes
	XLH2O: 2000, 	// For repair (or build)
	LH   : 2000, 	// (+50 % build and repair)
	XUHO2: 2000, 	// For harvest
	XKH2O: 2000, 	// For carry
	XGH2O: 12000 	// For upgraders
};

export interface Shortage {
	mineralType: string;
	amount: number;
}

// Compute priority and wanted stock
let numColonies = 1; //_.keys(Overmind.colonies).length;
let priorityStock: Shortage[] = [];
for (let resourceType in _priorityStock) {
	let stock = {
		mineralType: resourceType,
		amount     : numColonies * _priorityStock[resourceType]
	};
	priorityStock.push(stock);
}

let wantedStock: Shortage[] = [];
for (let resourceType in _wantedStock) {
	let stock = {
		mineralType: resourceType,
		amount     : numColonies * _wantedStock[resourceType]
	};
	wantedStock.push(stock);
}

export class Abathur {

	colony: Colony;
	priorityStock: Shortage[];
	wantedStock: Shortage[];
	assets: { [resourceType: string]: number };

	private _globalAssets: { [resourceType: string]: number };

	static settings = {
		minBatchSize: 100,	// anything less than this wastes time
		maxBatchSize: 1000, // manager carry capacity
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.priorityStock = priorityStock;
		this.wantedStock = wantedStock;
		this.assets = colony.assets;
	}

	/* Summarizes the total of all resources currently in a colony store structure */
	private computeGlobalAssets(): { [resourceType: string]: number } {
		let colonyAssets: { [resourceType: string]: number }[] = [];
		for (let colony of getAllColonies()) {
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

	/* Finds the next resource which needs to be produced */
	private getShortage(): Shortage | undefined {
		let stocksToCheck = [_priorityStock, _wantedStock];
		for (let stocks of stocksToCheck) {
			for (let resourceType in stocks) {
				let amountOwned = this.assets[resourceType] || 0;
				let amountNeeded = stocks[resourceType];
				if (amountOwned < amountNeeded) { // if there is a shortage of this resource
					let ret = this.recursivelyFindShortage({
															   mineralType: resourceType,
															   amount     : amountNeeded - amountOwned
														   });
					console.log(`${this.colony.name}: want ${resourceType}, produce ${ret ? ret.mineralType : 0}`);
					return ret;
				}
			}
		}
	}

	/* Recursively gets the next resource that needs to be produced */
	private recursivelyFindShortage(shortage: Shortage, firstRecursionLevel = false): Shortage | undefined {
		let amountOwned = this.assets[shortage.mineralType] || 0;
		let amountNeeded = shortage.amount - Math.floor(amountOwned / 10) * 10;
		if (firstRecursionLevel) {
			amountNeeded = shortage.amount;
		}
		if (amountNeeded > 0) { // if you need more of this resource
			let reagents = REAGENTS[shortage.mineralType];
			if (reagents) {  // if the resource is not a base mineral
				for (let reagent of reagents) {
					let nextShortage = this.recursivelyFindShortage({
																		mineralType: reagent,
																		amount     : amountNeeded
																	});
					if (nextShortage) {
						return nextShortage;
					}
				}
			} else {
				return {mineralType: shortage.mineralType, amount: amountNeeded};
			}
		}
	}

	/* Generate a queue of reactions to produce the most needed compound */
	getReactionQueue(): Shortage[] {
		let stocksToCheck = [_priorityStock, _wantedStock];
		for (let stocks of stocksToCheck) {
			for (let resourceType in stocks) {
				let amountOwned = this.assets[resourceType] || 0;
				let amountNeeded = stocks[resourceType];
				if (amountOwned < amountNeeded) { // if there is a shortage of this resource
					return this.buildReactionQueue(<ResourceConstant>resourceType, amountNeeded - amountOwned);
				}
			}
		}
		return [];
	}

	/* Figure out which basic minerals are missing and how much */
	getMissingBasicMinerals(reactionQueue: Shortage[]): { [resourceType: string]: number } {
		let requiredBasicMinerals = this.getRequiredBasicMinerals(reactionQueue);
		let missingBasicMinerals: { [resourceType: string]: number } = {};
		for (let mineralType in requiredBasicMinerals) {
			let amountMissing = requiredBasicMinerals[mineralType] - (this.assets[mineralType] || 0);
			if (amountMissing > 0) {
				missingBasicMinerals[mineralType] = amountMissing;
			}
		}
		return missingBasicMinerals;
	}

	/* Get the required amount of basic minerals for a reaction queue */
	private getRequiredBasicMinerals(reactionQueue: Shortage[]): { [resourceType: string]: number } {
		let requiredBasicMinerals: { [resourceType: string]: number } = {
			[RESOURCE_HYDROGEN] : 0,
			[RESOURCE_OXYGEN]   : 0,
			[RESOURCE_UTRIUM]   : 0,
			[RESOURCE_KEANIUM]  : 0,
			[RESOURCE_LEMERGIUM]: 0,
			[RESOURCE_ZYNTHIUM] : 0,
			[RESOURCE_CATALYST] : 0,
		};
		for (let shortage of reactionQueue) {
			let ingredients = REAGENTS[shortage.mineralType];
			for (let ingredient of ingredients) {
				if (!REAGENTS[ingredient]) { // resource is base mineral
					requiredBasicMinerals[ingredient] += shortage.amount;
				}
			}
		}
		return requiredBasicMinerals;
	}

	/* Build a reaction queue for a target compound */
	private buildReactionQueue(mineral: ResourceConstant, amount: number): Shortage[] {
		// Recipe iteration order is guaranteed to follow insertion order for non-integer keys in ES2015 and later
		// let recipe: { [resourceType: string]: number } = {};
		// for (let ingredient of this.ingredientsList(mineral)) {
		// 	if (!recipe[ingredient]) {
		// 		recipe[ingredient] = 0;
		// 	}
		// 	recipe[ingredient] += amount;
		// }
		let reactionQueue: Shortage[] = [];
		for (let ingredient of this.ingredientsList(mineral)) {
			let productionAmount = amount;
			if (ingredient != mineral) {
				productionAmount = Math.max(productionAmount - (this.assets[ingredient] || 0), 0);
			}
			productionAmount = Math.min(productionAmount, Abathur.settings.maxBatchSize);
			reactionQueue.push({mineralType: ingredient, amount: productionAmount});

		}

		// Scan backwards through the queue and reduce the production amount of subsequently baser resources as needed
		if (reactionQueue.length == 0) {
			return reactionQueue;
		}
		let minAmount = reactionQueue[0].amount;
		reactionQueue.reverse();
		for (let shortage of reactionQueue) {
			if (shortage.amount < minAmount) {
				minAmount = shortage.amount;
			}
			shortage.amount = Math.min(shortage.amount, minAmount);
		}
		reactionQueue.reverse();
		reactionQueue = _.filter(reactionQueue, shortage => shortage.amount > 0);
		_.forEach(reactionQueue, shrtage => shrtage.amount = Math.max(shrtage.amount, Abathur.settings.minBatchSize));
		return reactionQueue;
	}

	/* Return a list of ingredients required to produce a compound */
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
