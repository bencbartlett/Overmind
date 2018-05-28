import {Task} from '../Task';
import {profile} from '../../profiler/decorator';


export type reserveTargetType = StructureController;
export const reserveTaskName = 'colony';

@profile
export class TaskReserve extends Task {
	target: reserveTargetType;

	constructor(target: reserveTargetType, options = {} as TaskOptions) {
		super(reserveTaskName, target, options);
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
