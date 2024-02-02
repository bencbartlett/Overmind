import {profile} from '../../profiler/decorator';
import {Task} from '../Task';


export type reserveTargetType = StructureController;
export const reserveTaskName = 'colony';

@profile
export class TaskReserve extends Task<reserveTargetType> {

	constructor(target: reserveTargetType, options = {} as TaskOptions) {
		super(reserveTaskName, target, options);
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(CLAIM) > 0);
	}

	isValidTarget() {
		const target = this.target;
		return !!target && (!target.reservation || target.reservation.ticksToEnd < 4999);
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
		let ret = this.creep.reserveController(this.target);
		if (ret == ERR_INVALID_TARGET) {
			ret = this.creep.attackController(this.target);
		}
		return ret;
	}
}
