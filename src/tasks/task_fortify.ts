import {Task} from './Task';
import {profileClass} from '../profiling';

export type fortifyTargetType = StructureWall | Rampart;
export const fortifyTaskName = 'fortify';

export class TaskFortify extends Task {
	target: fortifyTargetType;

	constructor(target: fortifyTargetType) {
		super(fortifyTaskName, target);
		// Settings
		this.settings.moveColor = 'green';
	}

	isValidTask() {
		return (this.creep.carry.energy > 0);
	}

	isValidTarget() {
		let target = this.target;
		return (target != null && target.hits < target.hitsMax); // over-fortify to minimize extra trips
	}

	work() {
		return this.creep.repair(this.target);
	}
}

profileClass(TaskFortify);
