import {Task} from './Task';
import {profile} from '../lib/Profiler';
import {controllerSignature} from '../do-not-modify/do-not-modify';

export type signControllerTargetType = StructureController;
export const signControllerTaskName = 'signController';

@profile
export class TaskSignController extends Task {
	target: signControllerTargetType;

	constructor(target: signControllerTargetType, options = {} as TaskOptions) {
		super(signControllerTaskName, target, options);
		// Settings
		this.settings.moveColor = 'purple';
	}

	isValidTask() {
		return true;
	}

	isValidTarget() {
		let controller = this.target;
		return (!controller.sign || controller.sign.text != controllerSignature);
	}

	work() {
		return this.creep.signController(this.target, controllerSignature);
	}
}

