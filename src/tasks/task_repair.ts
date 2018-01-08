import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type repairTargetType = Structure;
export const repairTaskName = 'repair';

@profile
export class TaskRepair extends Task {
	target: repairTargetType;

	constructor(target: repairTargetType, options = {} as TaskOptions) {
		super(repairTaskName, target, options);
		// Settings
		this.settings.moveColor = 'green';
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		return this.target && this.target.hits < this.target.hitsMax;
	}

	work() {
		return this.creep.repair(this.target);
	}
}
