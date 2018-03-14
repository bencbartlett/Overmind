/* This is the task for withdrawing energy. For withdrawing other resources, see taskWithdrawResource. */

import {Task} from './Task';
import {profile} from '../lib/Profiler';
import {EnergyStructure, isEnergyStructure, StoreStructure} from '../declarations/typeGuards';

export type withdrawTargetType = EnergyStructure | StoreStructure;
// StructureContainer
// | StructureExtension
// | StructureLab
// | StructureLink
// | StructureNuker
// | StructurePowerSpawn
// | StructureSpawn
// | StructureStorage
// | StructureTerminal
// | StructureTower;
export const withdrawTaskName = 'withdraw';

@profile
export class TaskWithdraw extends Task {
	target: withdrawTargetType;

	constructor(target: withdrawTargetType, options = {} as TaskOptions) {
		super(withdrawTaskName, target, options);
	}

	isValidTask() {
		return _.sum(this.creep.carry) < this.creep.carryCapacity;
	}

	isValidTarget() {
		if (isEnergyStructure(this.target)) {
			return this.target && this.target.energy > 0;
		} else {
			return this.target && this.target.store[RESOURCE_ENERGY] > 0;
		}

	}

	work() {
		return this.creep.withdraw(this.target, RESOURCE_ENERGY);
	}
}
