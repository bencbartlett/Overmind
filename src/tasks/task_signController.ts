import {Task} from './Task';
import {controllerSignature} from '../settings/settings_user';
import {profile} from '../lib/Profiler';

export type signControllerTargetType = StructureController;
export const signControllerTaskName = 'signController';

@profile
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

