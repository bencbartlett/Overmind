import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type meleeAttackTargetType = Creep | Structure;
export const meleeAttackTaskName = 'meleeAttack';

@profile
export class TaskMeleeAttack extends Task {
	target: meleeAttackTargetType;

	constructor(target: meleeAttackTargetType, options = {} as TaskOptions) {
		super(meleeAttackTaskName, target, options);
		// Settings
		this.settings.targetRange = 1;
	}

	isValidTask() {
		return this.creep.getActiveBodyparts(ATTACK) > 0;
	}

	isValidTarget() {
		const target = this.target;
		return target && target.hits > 0; // && target.my == false);
	}

	work() {
		return this.creep.attack(this.target);
	}
}

