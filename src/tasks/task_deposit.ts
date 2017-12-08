import {Task} from './Task';
import {profileClass} from '../profiling';

type targetType =
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
export class TaskDeposit extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('deposit', target);
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

