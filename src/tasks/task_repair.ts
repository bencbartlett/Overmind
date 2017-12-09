import {Task} from './Task';
import {profileClass} from '../profiling';

export type repairTargetType = Structure;
export const repairTaskName = 'repair';

export class TaskRepair extends Task {
	target: repairTargetType;

	constructor(target: repairTargetType) {
		super(repairTaskName, target);
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
