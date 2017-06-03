import {Task} from './Task';

type targetType = Source;
export class TaskHarvest extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('harvest', target);
		// Settings
		this.taskData.moveColor = 'yellow';
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
