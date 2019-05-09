import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

// Attack task, includes attack and ranged attack if applicable.
// Use meleeAttack and rangedAttack for the exclusive variants.

// TODO: creep is only approaching to range 3
export type attackTargetType = Creep | Structure;
export const attackTaskName = 'attack';

@profile
export class TaskAttack extends Task {
	target: attackTargetType;

	constructor(target: attackTargetType, options = {} as TaskOptions) {
		super(attackTaskName, target, options);
		// Settings
		this.settings.targetRange = 3;
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(ATTACK) > 0 || this.creep.getActiveBodyparts(RANGED_ATTACK) > 0);
	}

	isValidTarget(): boolean {
		return this.target && this.target.hits > 0;
	}

	work() {
		const creep = this.creep;
		const target = this.target;
		let attackReturn = 0;
		let rangedAttackReturn = 0;
		if (creep.getActiveBodyparts(ATTACK) > 0) {
			if (creep.pos.isNearTo(target)) {
				attackReturn = creep.attack(target);
			} else {
				attackReturn = this.moveToTarget(1); // approach target if you also have attack parts
			}
		}
		if (creep.pos.inRangeTo(target, 3) && creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
			rangedAttackReturn = creep.rangedAttack(target);
		}
		if (attackReturn == OK && rangedAttackReturn == OK) {
			return OK;
		} else {
			if (attackReturn != OK) {
				return rangedAttackReturn;
			} else {
				return attackReturn;
			}
		}
	}
}
