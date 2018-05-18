// Abathur is responsible for the evolution of the swarm and directs global production of minerals

import {Colony} from '../Colony';
import {REAGENTS} from './map_resources';

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

interface Shortage {
	mineralType: string;
	amount: number;
}

// Compute priority and wanted stock
let numColonies = 1; //_.keys(Overmind.Colonies).length;
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

	constructor(colony: Colony) {
		this.colony = colony;
		this.priorityStock = priorityStock;
		this.wantedStock = wantedStock;
		this.assets = colony.getAllAssets();
	}

	/* Summarizes the total of all resources currently in a colony store structure */
	private computeGlobalAssets(): { [resourceType: string]: number } {
		let globalAssets: { [resourceType: string]: number } = {};
		for (let i in Overmind.Colonies) {
			let colonyAssets = Overmind.Colonies[i].getAllAssets();
			for (let resourceType in colonyAssets) {
				if (!globalAssets[resourceType]) {
					globalAssets[resourceType] = 0;
				}
				globalAssets[resourceType] += (colonyAssets[resourceType] || 0);
			}
		}
		return globalAssets;
	}

	get globalAssets(): { [resourceType: string]: number } {
		if (!this._globalAssets) {
			this._globalAssets = this.computeGlobalAssets();
		}
		return this._globalAssets;
	}

	private getShortage(): Shortage | undefined {
		let stocksToCheck = [_priorityStock, _wantedStock];
		for (let stocks of stocksToCheck) {
			for (let resourceType in _priorityStock) {
				let amountOwned = this.assets[resourceType] || 0;
				let amountNeeded = _priorityStock[resourceType];
				if (amountOwned < amountNeeded) { // if there is a shortage of this resource
					return this.recursivelyFindShortage({
															mineralType: resourceType,
															amount     : amountNeeded - amountOwned
														});
				}
			}
		}
	}

	private recursivelyFindShortage(shortage: Shortage, firstRecursionLevel = false): Shortage | undefined {
		let amountOwned = this.assets[shortage.mineralType] || 0;
		let amountNeeded = shortage.amount - Math.floor(amountOwned / 10) * 10;
		if (firstRecursionLevel) {
			amountNeeded = shortage.amount;
		}
		if (amountNeeded > 0) { // if you need more of this resource
			let reagents = REAGENTS[shortage.mineralType];
			let shortageFound;
			if (reagents) {  // if the resource is not a base mineral
				for (let reagent of reagents) {
					let shortage = this.recursivelyFindShortage({
																	mineralType: reagent,
																	amount     : amountNeeded
																});
					if (shortage) {
						return shortage;
					}
				}
			} else {
				return {mineralType: shortage.mineralType, amount: amountNeeded};
			}
		}
	}
}
