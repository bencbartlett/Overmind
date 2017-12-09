import {Task} from './Task';
import {profileClass} from '../profiling';

export type harvestTargetType = Source;
export const harvestTaskName = 'harvest';

export class TaskHarvest extends Task {
	target: harvestTargetType;

	constructor(target: harvestTargetType) {
		super(harvestTaskName, target);
		// Settings
		this.settings.moveColor = 'yellow';
	}

	isValidTask() {
		return this.creep.carry.energy < this.creep.carryCapacity;
	}

	isValidTarget() {
		return this.target && this.target.energy > 0;
	}

	work() {
		return this.creep.harvest(this.target);
	}
}

profileClass(TaskHarvest);
