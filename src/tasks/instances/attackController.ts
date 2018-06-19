import {Task} from '../Task';
import {profile} from '../../profiler/decorator';

export type attackControllerTargetType = StructureController;
export const attackControllerTaskName = 'attackController';

@profile
export class TaskAttackController extends Task {
	target: attackControllerTargetType;

	constructor(target: attackControllerTargetType, options = {} as TaskOptions) {
		super(attackControllerTaskName, target, options);
		// Settings
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(CLAIM) > 0);
	}

	isValidTarget() {
		return (this.target != null && (!this.target.room || !this.target.owner));
	}

	work() {
		return this.creep.attackController(this.target);
	}
}
