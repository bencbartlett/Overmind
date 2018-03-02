import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type depositTargetType = StructureContainer | StructureExtension | StructureLab | StructureLink |
	StructureNuker | StructurePowerSpawn | StructureSpawn | StructureStorage | StructureTerminal | StructureTower;
export const depositTaskName = 'deposit';

@profile
export class TaskDeposit extends Task {
	target: depositTargetType;

	constructor(target: depositTargetType, options = {} as TaskOptions) {
		super(depositTaskName, target, options);
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		let target = this.target;
		if (target instanceof StructureLab ||
			target instanceof StructureNuker ||
			target instanceof StructurePowerSpawn) {
			return target.energy < target.energyCapacity;
		} else {
			return !target.isFull;
		}
	}

	work() {
		return this.creep.transfer(this.target, RESOURCE_ENERGY);
	}
}


