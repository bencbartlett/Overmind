import {Task} from './Task';
import {controllerSignature} from '../settings/settings_user';

type targetType = Controller;
export class TaskSignController extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('signController', target);
		// Settings
		this.taskData.moveColor = 'purple';
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

