// Invalid task assigned if instantiation fails.

import {Task} from '../Task';
import {profile} from '../../profiler/decorator';

@profile
export class TaskInvalid extends Task {
	target: any;

	constructor(target: any, options = {} as TaskOptions) {
		super('INVALID', target, options);
	}

	isValidTask() {
		return false;
	}

	isValidTarget() {
		return false;
	}

	work() {
		return OK;
	}
}
