import {Task} from './Task';
import {controllerSignature} from '../settings/settings_user';
import {profileClass} from '../profiling';

export type signControllerTargetType = Controller;
export const signControllerTaskName = 'signController';

export class TaskSignController extends Task {
	target: signControllerTargetType;

	constructor(target: signControllerTargetType) {
		super(signControllerTaskName, target);
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

profileClass(TaskSignController);

