import {Task} from './Task';
import {profile} from '../lib/Profiler';


export type reserveTargetType = StructureController;
export const reserveTaskName = 'colony';

@profile
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
