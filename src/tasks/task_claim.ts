import {Task} from './Task';
import {profileClass} from '../profiling';

export type claimTargetType = StructureController;
export const claimTaskName = 'claim';

export class TaskClaim extends Task {
	target: claimTargetType;

	constructor(target: claimTargetType) {
		super(claimTaskName, target);
		// Settings
		this.settings.moveColor = 'purple';
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(CLAIM) > 0);
	}

	isValidTarget() {
		var target = this.target;
		return (target != null && (!target.room || !target.owner));
	}

	work() {
		return this.creep.claimController(this.target);
	}
}

profileClass(TaskClaim);
