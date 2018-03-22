// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord

import {profile} from '../profiler/decorator';
import {Zerg} from '../Zerg';
import {log} from '../lib/logger/log';
import {Colony} from '../Colony';
import {TransporterSetup} from '../creepSetup/defaultSetups';
import {EnergyStructure, isEnergyStructure, isStoreStructure, StoreStructure} from '../declarations/typeGuards';


export type LogisticsTarget = EnergyStructure | StoreStructure | StructureLab | StructureNuker | StructurePowerSpawn //| Zerg;
// export type LogisticsTarget = StructureContainer | StructureStorage | Flag;
export type BufferTarget = StructureStorage | StructureTerminal;

// export interface Request {
// 	id: string;
// 	target: LogisticsTarget;
// 	amount: number;
// 	resourceType: ResourceConstant;
// 	multiplier: number;
// }
//

interface RequestOptions {
	amount?: number //| ((time: number) => number);
	resourceType?: ResourceConstant;
	multiplier?: number;
}

export interface LogisticsItem {
	// id: string;
	target: LogisticsTarget;
	pos: RoomPosition;
	amount: number // | ((time: number) => number);
	resourceType: ResourceConstant;
}

@profile
export class LogisticsNetwork {

	requesters: LogisticsItem[];
	activeProviders: LogisticsItem[];
	passiveProviders: LogisticsItem[];
	links: StructureLink[];
	buffers: BufferTarget[];
	colony: Colony;
	settings: {
		flagDropAmount: number;
		rangeToPathHeuristic: number;
	};

	constructor(colony: Colony) {
		this.requesters = [];
		this.activeProviders = [];
		this.passiveProviders = [];
		this.settings = {
			flagDropAmount      : 1000,
			rangeToPathHeuristic: 1.2, // findClosestByRange * this ~= findClosestByPos except in pathological cases
		};
		this.colony = colony;
		this.buffers = _.compact([colony.storage!, colony.terminal!]);
		this.links = colony.dropoffLinks;
	}

	private getRequestAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		if (isStoreStructure(target)) {
			return target.storeCapacity - _.sum(target.store);
		} else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
			return target.energyCapacity - target.energy;
		} else if (target instanceof Zerg) {
			return target.carryCapacity - _.sum(target.carry);
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

	private getProvideAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		if (isStoreStructure(target)) {
			return target.store[resourceType]!;
		} else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
			return target.energy;
		} else if (target instanceof Zerg) {
			return target.carry[resourceType]!;
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

	/* Request for resources to be deposited into this structure */
	request(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
		});
		if (!opts.amount) {
			opts.amount = this.getRequestAmount(target, opts.resourceType!);
		}
		// Modify the amount by the number of transporters currently targeting
		let targetingZerg = _.map(target.targetedBy, name => Game.zerg[name]);
		let targetingTransporters = _.filter(targetingZerg, zerg => zerg.roleName == TransporterSetup.role);
		let energyInflux = _.sum(_.map(targetingTransporters, transporter => transporter.carryCapacity));
		opts.amount = Math.max(opts.amount - energyInflux, 0);
		// Register the request
		// let requestID = this.requests.length.toString();
		let req = {
			// id          : requestID,
			target      : target,
			pos         : target.pos,
			amount      : opts.amount,
			resourceType: opts.resourceType!,
			multiplier  : opts.multiplier!,
		};
		this.requesters.push(req);
	}

	/* Request for resources to be withdrawn from this structure */
	provide(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
		});
		if (!opts.amount) {
			opts.amount = this.getProvideAmount(target, opts.resourceType!);
		}
		// opts.amount *= -1;
		// Modify the amount by the number of transporters currently targeting
		let targetingZerg = _.map(target.targetedBy, name => Game.zerg[name]);
		let targetingTransporters = _.filter(targetingZerg, zerg => zerg.roleName == TransporterSetup.role);
		let energyOutflux = _.sum(_.map(targetingTransporters, transporter => transporter.carryCapacity));
		opts.amount = Math.min(opts.amount + energyOutflux, 0);
		// Register the request
		// let requestID = this.requests.length.toString();
		let req = {
			// id          : requestID,
			target      : target,
			pos         : target.pos,
			amount      : opts.amount,
			resourceType: opts.resourceType!,
			multiplier  : opts.multiplier!,
		};
		this.activeProviders.push(req);
	}

	/* Request for resources to be withdrawn from this structure */
	passiveProvide(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
		});
		if (!opts.amount) {
			opts.amount = this.getProvideAmount(target, opts.resourceType!);
		}
		// opts.amount *= -1;
		// Modify the amount by the number of transporters currently targeting
		let targetingZerg = _.map(target.targetedBy, name => Game.zerg[name]);
		let targetingTransporters = _.filter(targetingZerg, zerg => zerg.roleName == TransporterSetup.role);
		let energyOutflux = _.sum(_.map(targetingTransporters, transporter => transporter.carryCapacity));
		opts.amount = Math.min(opts.amount + energyOutflux, 0);
		// Register the request
		// let requestID = this.requests.length.toString();
		let req = {
			// id          : requestID,
			target      : target,
			pos         : target.pos,
			amount      : opts.amount,
			resourceType: opts.resourceType!,
			multiplier  : opts.multiplier!,
		};
		this.passiveProviders.push(req);
	}

}

