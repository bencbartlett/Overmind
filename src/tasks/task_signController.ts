import {Task} from './Task';
import {controllerSignature} from '../settings/settings_user';
import {profileClass} from '../profiling';

type targetType = Controller;
export class TaskSignController extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('signController', target);
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

