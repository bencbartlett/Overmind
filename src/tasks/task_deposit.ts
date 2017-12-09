import {Task} from './Task';
import {profileClass} from '../profiling';

export type depositTargetType =
	StructureContainer |
	StructureExtension |
	StructureLab |
	StructureLink |
	StructureNuker |
	StructurePowerSpawn |
	StructureSpawn |
	StructureStorage |
	StructureTower |
	StructureTerminal;
export const depositTaskName = 'deposit';

export class TaskDeposit extends Task {
	target: depositTargetType;

	constructor(target: depositTargetType) {
		super(depositTaskName, target);
		// Settings
		this.settings.moveColor = 'blue';
		this.data.quiet = true;
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

profileClass(TaskDeposit);

