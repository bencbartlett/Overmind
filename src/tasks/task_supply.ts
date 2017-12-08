import {Task} from './Task';
import {profileClass} from '../profiling';

type targetType = Sink;
export class TaskSupply extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('supply', target);
		// Settings
		this.settings.moveColor = 'blue';
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

profileClass(TaskSupply);
