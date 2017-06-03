import {Task} from './Task';

type targetType = Controller;
export class TaskReserve extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('colony', target);
		// Settings
		this.taskData.moveColor = 'purple';
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(CLAIM) > 0);
	}

	isValidTarget() {
		var target = this.target;
		return (target != null && (!target.reservation || target.reservation.ticksToEnd < 4999 ));
	}

	work() {
		return this.creep.reserveController(this.target);
	}
}

