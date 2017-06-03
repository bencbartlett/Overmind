import {Task} from './Task';

type targetType = Sink;
export class TaskSupply extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('supply', target);
		// Settings
		this.taskData.maxPerTarget = 1;
		this.taskData.moveColor = 'blue';
		this.data.quiet = true;
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		return this.target && !this.target.isFull;
	}

	work() {
		return this.creep.transfer(this.target, RESOURCE_ENERGY);
	}
}

