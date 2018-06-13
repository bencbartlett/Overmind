// A stripped-down version of the logistics network intended for local deliveries

import {profile} from '../profiler/decorator';
import {blankPriorityQueue, Priority} from '../priorities/priorities';
import {EnergyStructure, isEnergyStructure, isStoreStructure, StoreStructure} from '../declarations/typeGuards';
import {log} from '../lib/logger/log';

export type TransportRequestTarget =
	EnergyStructure
	| StoreStructure
	| StructureLab
	| StructureNuker
	| StructurePowerSpawn

export interface TransportRequest {
	target: TransportRequestTarget;
	amount: number;
	resourceType: ResourceConstant;
}

interface TransportRequestOptions {
	amount?: number;
	resourceType?: ResourceConstant;
}

@profile
export class TransportRequestGroup {

	supply: { [priority: number]: TransportRequest[] };
	withdraw: { [priority: number]: TransportRequest[] };

	constructor() {
		this.supply = blankPriorityQueue();
		this.withdraw = blankPriorityQueue();
	}

	get needsSupplying(): boolean {
		for (let priority in this.supply) {
			if (this.supply[priority].length > 0) {
				return true;
			}
		}
		return false;
	}

	get needsWithdrawing(): boolean {
		for (let priority in this.withdraw) {
			if (this.withdraw[priority].length > 0) {
				return true;
			}
		}
		return false;
	}

	getPrioritizedClosestRequest(pos: RoomPosition, type: 'supply' | 'withdraw',
								 filter: ((requst: TransportRequest) => boolean) | undefined = undefined
	): TransportRequest | undefined {
		let requests = type == 'withdraw' ? this.withdraw : this.supply;
		for (let priority in requests) {
			let targets = _.map(requests[priority], request => request.target);
			let target = pos.findClosestByRangeThenPath(targets);
			if (target) {
				let searchRequests;
				if (filter) {
					searchRequests = _.filter(requests[priority], req => filter(req));
				} else {
					searchRequests = requests[priority];
				}
				return _.find(searchRequests, request => request.target.ref == target.ref);
			}
		}
	}

	/* Request for resources to be deposited into this target */
	request(target: TransportRequestTarget, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
		});
		if (!opts.amount) {
			opts.amount = this.getRequestAmount(target, opts.resourceType!);
		}
		// Register the request
		let req: TransportRequest = {
			target      : target,
			resourceType: opts.resourceType!,
			amount      : opts.amount!,
		};
		if (opts.amount > 0) {
			this.supply[priority].push(req);
		}
	}

	/* Request for resources to be withdrawn from this target */
	provide(target: TransportRequestTarget, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
		});
		if (!opts.amount) {
			opts.amount = this.getProvideAmount(target, opts.resourceType!);
		}
		// Register the request
		let req: TransportRequest = {
			target      : target,
			resourceType: opts.resourceType!,
			amount      : opts.amount!,
		};
		if (opts.amount > 0) {
			this.withdraw[priority].push(req);
		}
	}

	/* Makes a provide for every resourceType in a requestor object */
	provideAll(target: StoreStructure, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
		for (let resourceType in target.store) {
			let amount = target.store[<ResourceConstant>resourceType] || 0;
			if (amount > 0) {
				opts.resourceType = <ResourceConstant>resourceType;
				this.provide(target, priority, opts);
			}
		}
	}

	private getRequestAmount(target: TransportRequestTarget, resourceType: ResourceConstant): number {
		if (isStoreStructure(target)) {
			return target.storeCapacity - _.sum(target.store);
		} else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
			return target.energyCapacity - target.energy;
		} else {
			if (target instanceof StructureLab) {
				if (resourceType == target.mineralType) {
					return target.mineralCapacity - target.mineralAmount;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energyCapacity - target.energy;
				}
			} else if (target instanceof StructureNuker) {
				if (resourceType == RESOURCE_GHODIUM) {
					return target.ghodiumCapacity - target.ghodium;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energyCapacity - target.energy;
				}
			} else if (target instanceof StructurePowerSpawn) {
				if (resourceType == RESOURCE_POWER) {
					return target.powerCapacity - target.power;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energyCapacity - target.energy;
				}
			}
		}
		log.warning('Could not determine requestor amount!');
		return 0;
	}

	private getProvideAmount(target: TransportRequestTarget, resourceType: ResourceConstant): number {
		if (isStoreStructure(target)) {
			return target.store[resourceType]!;
		} else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
			return target.energy;
		} else {
			if (target instanceof StructureLab) {
				if (resourceType == target.mineralType) {
					return target.mineralAmount;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energy;
				}
			} else if (target instanceof StructureNuker) {
				if (resourceType == RESOURCE_GHODIUM) {
					return target.ghodium;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energy;
				}
			} else if (target instanceof StructurePowerSpawn) {
				if (resourceType == RESOURCE_POWER) {
					return target.power;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energy;
				}
			}
		}
		log.warning('Could not determine provider amount!');
		return 0;
	}

	summarize(): void {
		console.log(`Supply requests:`);
		for (let priority in this.supply) {
			console.log(`Priority: ${priority}`);
			for (let request of this.supply[priority]) {
				console.log(`    targetID: ${request.target.ref}  amount: ${request.amount}  ` +
							`resourceType: ${request.resourceType}`);
			}
		}
		console.log(`Withdraw requests:`);
		for (let priority in this.withdraw) {
			console.log(`Priority: ${priority}`);
			for (let request of this.withdraw[priority]) {
				console.log(`    targetID: ${request.target.ref}  amount: ${request.amount}  ` +
							`resourceType: ${request.resourceType}`);
			}
		}
	}
}
