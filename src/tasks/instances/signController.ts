import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type signControllerTargetType = StructureController;
export const signControllerTaskName = 'signController';

@profile
export class TaskSignController extends Task<signControllerTargetType> {

	constructor(target: signControllerTargetType, options = {} as TaskOptions) {
		super(signControllerTaskName, target, options);
	}

	isValidTask() {
		return true;
	}

	isValidTarget() {
		const controller = this.target;
		return !!controller &&
			   (!controller.sign || controller.sign.text != Memory.settings.signature) &&
			   !controller.signedByScreeps;
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
		return this.creep.signController(this.target, Memory.settings.signature);
	}
}

