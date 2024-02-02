// A stripped-down version of the logistics network intended for local deliveries

import {blankPriorityQueue, Priority} from '../priorities/priorities';
import {profile} from '../profiler/decorator';

// export type TransportRequestTarget =
// 	StructureContainer
// 	| StructureExtension
// 	| StructureFactory
// 	| StructureLab
// 	| StructureLink
// 	| StructureNuker
// 	| StructurePowerSpawn
// 	| StructureSpawn
// 	| StructureStorage
// 	| StructureTerminal
// 	| StructureTower
// 	| Ruin
// 	| Tombstone;

export type TransportRequestTarget = TransferrableStoreStructure;

export interface TransportRequest {
	target: TransportRequestTarget;
	amount: number;
	resourceType: ResourceConstant;
}

interface TransportRequestOptions {
	amount?: number;
	resourceType?: ResourceConstant;
}


/**
 * Transport request groups handle close-range prioritized resource requests, in contrast to the logistics network,
 * which handles longer-ranged requests
 */
@profile
export class TransportRequestGroup {

	supply: { [priority: number]: TransportRequest[] };
	withdraw: { [priority: number]: TransportRequest[] };
	supplyByID: { [id: string]: TransportRequest[] };
	withdrawByID: { [id: string]: TransportRequest[] };

	constructor() {
		this.refresh();
	}

	refresh(): void {
		this.supply = blankPriorityQueue();
		this.withdraw = blankPriorityQueue();
		this.supplyByID = {};
		this.withdrawByID = {};
	}

	needsSupplying(priorityThreshold?: Priority): boolean {
		for (const priority in this.supply) {
			if (priorityThreshold != undefined && parseInt(priority, 10) > priorityThreshold) {
				continue; // lower numerical priority values are more important; if priority > threshold then ignore it
			}
			if (this.supply[priority].length > 0) {
				return true;
			}
		}
		return false;
	}

	needsWithdrawing(priorityThreshold?: Priority): boolean {
		for (const priority in this.withdraw) {
			if (priorityThreshold != undefined && parseInt(priority, 10) > priorityThreshold) {
				continue; // lower numerical priority values are more important; if priority > threshold then ignore it
			}
			if (this.withdraw[priority].length > 0) {
				return true;
			}
		}
		return false;
	}

	getPrioritizedClosestRequest(pos: RoomPosition, type: 'supply' | 'withdraw',
								 filter?: ((requst: TransportRequest) => boolean)): TransportRequest | undefined {
		const requests = type == 'withdraw' ? this.withdraw : this.supply;
		for (const priority in requests) {
			const targets = _.map(requests[priority], request => request.target);
			const target = pos.findClosestByRangeThenPath(targets);
			if (target) {
				let searchRequests;
				if (filter) {
					searchRequests = _.filter(requests[priority], req => filter(req));
				} else {
					searchRequests = requests[priority];
				}
				return _.find(searchRequests, request => request.target.ref == target!.ref);
			}
		}
	}

	/**
	 * Request for resources to be deposited into this target
	 */
	requestInput(target: TransportRequestTarget, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
		});
		if (opts.amount == undefined) {
			opts.amount = this.getInputAmount(target, opts.resourceType!);
		}
		// Register the request
		const req: TransportRequest = {
			target      : target,
			resourceType: opts.resourceType!,
			amount      : opts.amount!,
		};
		if (opts.amount > 0) {
			this.supply[priority].push(req);
			if (!this.supplyByID[target.id]) this.supplyByID[target.id] = [];
			this.supplyByID[target.id].push(req);
		}
	}

	/**
	 * Request for resources to be withdrawn from this target
	 */
	requestOutput(target: TransportRequestTarget, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
		});
		if (opts.amount == undefined) {
			opts.amount = this.getOutputAmount(target, opts.resourceType!);
		}
		// Register the request
		const req: TransportRequest = {
			target      : target,
			resourceType: opts.resourceType!,
			amount      : opts.amount!,
		};
		if (opts.amount > 0) {
			this.withdraw[priority].push(req);
			if (!this.withdrawByID[target.id]) this.withdrawByID[target.id] = [];
			this.withdrawByID[target.id].push(req);
		}
	}

	// /* Makes a provide for every resourceType in a requestor object */
	// requestOutputAll(target: StoreStructure, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
	// 	for (let resourceType in target.store) {
	// 		let amount = target.store[<ResourceConstant>resourceType] || 0;
	// 		if (amount > 0) {
	// 			opts.resourceType = <ResourceConstant>resourceType;
	// 			this.requestOutput(target, priority, opts);
	// 		}
	// 	}
	// }

	private getInputAmount(target: TransportRequestTarget, resourceType: ResourceConstant): number {
		return target.store.getFreeCapacity(resourceType) || 0;

		// Legacy code from before the structure.store refactor
		// if (isStoreStructure(target)) {
		// 	return target.storeCapacity - _.sum(target.store);
		// } else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
		// 	return target.energyCapacity - target.energy;
		// } else {
		// 	if (target instanceof StructureLab) {
		// 		if (resourceType == target.mineralType) {
		// 			return target.mineralCapacity - target.mineralAmount;
		// 		} else if (resourceType == RESOURCE_ENERGY) {
		// 			return target.energyCapacity - target.energy;
		// 		}
		// 	} else if (target instanceof StructureNuker) {
		// 		if (resourceType == RESOURCE_GHODIUM) {
		// 			return target.ghodiumCapacity - target.ghodium;
		// 		} else if (resourceType == RESOURCE_ENERGY) {
		// 			return target.energyCapacity - target.energy;
		// 		}
		// 	} else if (target instanceof StructurePowerSpawn) {
		// 		if (resourceType == RESOURCE_POWER) {
		// 			return target.powerCapacity - target.power;
		// 		} else if (resourceType == RESOURCE_ENERGY) {
		// 			return target.energyCapacity - target.energy;
		// 		}
		// 	}
		// }
		// log.warning('Could not determine requestor amount!');
		// return 0;
	}

	private getOutputAmount(target: TransportRequestTarget, resourceType: ResourceConstant): number {
		// @ts-ignore
		return target.store.getUsedCapacity(resourceType) || 0;

		// Legacy code from before the structure.store refactor
		// if (isStoreStructure(target)) {
		// 	return target.store[resourceType]!;
		// } else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
		// 	return target.energy;
		// } else {
		// 	if (target instanceof StructureLab) {
		// 		if (resourceType == target.mineralType) {
		// 			return target.mineralAmount;
		// 		} else if (resourceType == RESOURCE_ENERGY) {
		// 			return target.energy;
		// 		}
		// 	} else if (target instanceof StructureNuker) {
		// 		if (resourceType == RESOURCE_GHODIUM) {
		// 			return target.ghodium;
		// 		} else if (resourceType == RESOURCE_ENERGY) {
		// 			return target.energy;
		// 		}
		// 	} else if (target instanceof StructurePowerSpawn) {
		// 		if (resourceType == RESOURCE_POWER) {
		// 			return target.power;
		// 		} else if (resourceType == RESOURCE_ENERGY) {
		// 			return target.energy;
		// 		}
		// 	}
		// }
		// log.warning('Could not determine provider amount!');
		// return 0;
	}

	/**
	 * Summarize the state of the transport request group to the console; useful for debugging.
	 */
	summarize(ignoreEnergy = false): void {
		console.log(`Supply requests ==========================`);
		for (const priority in this.supply) {
			if (this.supply[priority].length > 0) {
				console.log(`Priority: ${priority}`);
			}
			for (const request of this.supply[priority]) {
				if (ignoreEnergy && request.resourceType == RESOURCE_ENERGY) continue;
				console.log(`    targetID: ${request.target.ref}  amount: ${request.amount}  ` +
							`resourceType: ${request.resourceType}`);
			}
		}
		console.log(`Withdraw requests ========================`);
		for (const priority in this.withdraw) {
			if (this.withdraw[priority].length > 0) {
				console.log(`Priority: ${priority}`);
			}
			for (const request of this.withdraw[priority]) {
				if (ignoreEnergy && request.resourceType == RESOURCE_ENERGY) continue;
				console.log(`    targetID: ${request.target.ref}  amount: ${request.amount}  ` +
							`resourceType: ${request.resourceType}`);
			}
		}
	}
}
