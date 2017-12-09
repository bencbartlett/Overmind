import {Task} from './Task';
import {profileClass} from '../profiling';

export type reserveTargetType = Controller;
export const reserveTaskName = 'colony';

export class TaskReserve extends Task {
	target: reserveTargetType;

	constructor(target: reserveTargetType) {
		super(reserveTaskName, target);
		// Settings
		this.settings.moveColor = 'purple';
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

profileClass(TaskReserve);
