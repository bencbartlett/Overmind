import {profile} from '../../profiler/decorator';
import {Task} from '../Task';


export type dismantleTargetType = Structure;
export const dismantleTaskName = 'dismantle';

@profile
export class TaskDismantle extends Task<dismantleTargetType> {

	constructor(target: dismantleTargetType, options = {} as TaskOptions) {
		super(dismantleTaskName, target, options);
		this.settings.timeout = 100;
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(WORK) > 0);
	}

	isValidTarget() {
		return !!this.target && this.target.hits > 0;
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
		return this.creep.dismantle(this.target);
	}
}
