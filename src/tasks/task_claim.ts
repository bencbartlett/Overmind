import {Task} from './Task';

type targetType = Controller;
export class TaskClaim extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('claim', target);
		// Settings
		this.taskData.moveColor = 'purple';
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
