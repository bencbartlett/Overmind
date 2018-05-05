// /* This is the task for withdrawing energy. For withdrawing other resources, see taskWithdrawResource. */
//
// import {Task} from './Task';
// import {profile} from '../profiler/decorator';
// import {EnergyStructure, isEnergyStructure, StoreStructure} from '../declarations/typeGuards';
//
// export type withdrawTargetType = EnergyStructure | StoreStructure;
// // StructureContainer
// // | StructureExtension
// // | StructureLab
// // | StructureLink
// // | StructureNuker
// // | StructurePowerSpawn
// // | StructureSpawn
// // | StructureStorage
// // | StructureTerminal
// // | StructureTower;
// export const withdrawTaskName = 'withdraw';
//
// @profile
// export class TaskWithdraw extends Task {
// 	target: withdrawTargetType;
//
// 	constructor(target: withdrawTargetType, options = {} as TaskOptions) {
// 		super(withdrawTaskName, target, options);
// 	}
//
// 	isValidTask() {
// 		return _.sum(this.creep.carry) < this.creep.carryCapacity;
// 	}
//
// 	isValidTarget() {
// 		if (isEnergyStructure(this.target)) {
// 			return this.target && this.target.energy > 0;
// 		} else {
// 			return this.target && this.target.store[RESOURCE_ENERGY] > 0;
// 		}
//
// 	}
//
// 	work() {
// 		return this.creep.withdraw(this.target, RESOURCE_ENERGY);
// 	}
// }

/* This is the withdrawal task for non-energy resources. */

import {Task} from './Task';
import {profile} from '../profiler/decorator';
import {EnergyStructure, isEnergyStructure, isStoreStructure, StoreStructure} from '../declarations/typeGuards';

export type withdrawTargetType =
	EnergyStructure
	| StoreStructure
	| StructureLab
	| StructureNuker
	| StructurePowerSpawn
	| Tombstone;

export const withdrawTaskName = 'withdraw';

@profile
export class TaskWithdraw extends Task {

	target: withdrawTargetType;
	data: {
		resourceType: ResourceConstant,
		amount: number | undefined,
	};

	constructor(target: withdrawTargetType,
				resourceType: ResourceConstant = RESOURCE_ENERGY,
				amount: number | undefined     = undefined,
				options                        = {} as TaskOptions) {
		super(withdrawTaskName, target, options);
		// Settings
		this.data.resourceType = resourceType;
		this.data.amount = amount;
	}

	isValidTask() {
		let amount = this.data.amount || 1;
		return (_.sum(this.creep.carry) <= this.creep.carryCapacity - amount);
	}

	isValidTarget() {
		let amount = this.data.amount || 1;
		let target = this.target;
		if (target instanceof Tombstone || isStoreStructure(target)) {
			return (target.store[this.data.resourceType] || 0) >= amount;
		} else if (isEnergyStructure(target) && this.data.resourceType == RESOURCE_ENERGY) {
			return target.energy >= amount;
		} else {
			if (target instanceof StructureLab) {
				return this.data.resourceType == target.mineralType && target.mineralAmount >= amount;
			} else if (target instanceof StructureNuker) {
				return this.data.resourceType == RESOURCE_GHODIUM && target.ghodium >= amount;
			} else if (target instanceof StructurePowerSpawn) {
				return this.data.resourceType == RESOURCE_POWER && target.power >= amount;
			}
		}
		return false;
	}

	work() {
		return this.creep.withdraw(this.target, this.data.resourceType, this.data.amount);
	}

}

