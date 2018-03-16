import {Task} from './Task';
import {profile} from '../profiler/decorator';
import {overmindSignature} from '../settings/do-not-modify';

export type signControllerTargetType = StructureController;
export const signControllerTaskName = 'signController';

@profile
export class TaskSignController extends Task {
	target: signControllerTargetType;

	constructor(target: signControllerTargetType, options = {} as TaskOptions) {
		super(signControllerTaskName, target, options);
	}

	isValidTask() {
		return true;
	}

	isValidTarget() {
		let controller = this.target;
		return (!controller.sign || controller.sign.text != overmindSignature);
	}

	work() {
		return this.creep.signController(this.target, overmindSignature);
	}
}

