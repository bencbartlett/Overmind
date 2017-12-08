import {Task} from './Task';
import {profileClass} from '../profiling';

type targetType = Structure;
export class TaskRepair extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('repair', target);
		// Settings
		this.settings.moveColor = 'green';
	}

	isValidTask() {
		return (this.creep.carry.energy > 0);
	}

	isValidTarget() {
		var target = this.target;
		return target.hits < target.hitsMax;
	}

	work() {
		return this.creep.repair(this.target);
	}
}

profileClass(TaskRepair);
