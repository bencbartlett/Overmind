import {Task} from './Task';
import {profile} from '../lib/Profiler';
import {controllerSignature} from '../settings/settings_user';


export type reserveTargetType = StructureController;
export const reserveTaskName = 'colony';

@profile
export class TaskReserve extends Task {
	target: reserveTargetType;

	constructor(target: reserveTargetType, options = {} as TaskOptions) {
		super(reserveTaskName, target, options);
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
		if (Game.time % 100 == 0 && !this.target.signedByMe) {
			this.creep.signController(this.target, controllerSignature);
		}
		return this.creep.reserveController(this.target);
	}
}
