import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type healTargetType = Creep;
export const healTaskName = 'heal';

@profile
export class TaskHeal extends Task {
	target: healTargetType;

	constructor(target: healTargetType, options = {} as TaskOptions) {
		super(healTaskName, target, options);
		// Settings
		this.settings.targetRange = 3;
	}


	isValidTask() {
		return (this.creep.getActiveBodyparts(HEAL) > 0);
	}

	isValidTarget() {
		return this.target && this.target.hits < this.target.hitsMax && this.target.my;
	}

	work() {
		if (this.creep.pos.isNearTo(this.target)) {
			return this.creep.heal(this.target);
		} else {
			this.moveToTarget(1);
		}
		return this.creep.rangedHeal(this.target);
	}
}
