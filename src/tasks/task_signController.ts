import {Task} from './Task';
import {profile} from '../profiler/decorator';
import {signature} from '../settings/settings_user';

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
		return (!controller.sign || controller.sign.text != signature);
	}

	work() {
		return this.creep.signController(this.target, signature);
	}
}

