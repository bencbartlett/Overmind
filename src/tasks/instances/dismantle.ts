import {profile} from '../../profiler/decorator';
import {Task} from '../Task';


export type dismantleTargetType = Structure;
export const dismantleTaskName = 'dismantle';

@profile
export class TaskDismantle extends Task {
	target: dismantleTargetType;

	constructor(target: dismantleTargetType, options = {} as TaskOptions) {
		super(dismantleTaskName, target, options);
		this.settings.timeout = 100;
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(WORK) > 0);
	}

	isValidTarget() {
		return this.target && this.target.hits > 0;
	}

	work() {
		return this.creep.dismantle(this.target);
	}
}
