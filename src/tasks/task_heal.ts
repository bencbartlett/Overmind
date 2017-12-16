import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type healTargetType = Creep;
export const healTaskName = 'heal';

@profile
export class TaskHeal extends Task {
	target: healTargetType;

	constructor(target: healTargetType) {
		super('heal', target);
		// Settings
		this.settings.moveColor = 'green';
		this.settings.targetRange = 3;
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(HEAL) > 0);
	}

	isValidTarget() {
		var target = this.target;
		return (target && target.hits < target.hitsMax && target.my == true);
	}

	work() {
		var creep = this.creep;
		var target = this.target;
		if (creep.pos.isNearTo(target)) {
			return creep.heal(target);
		} else {
			this.move();
		}
		return creep.rangedHeal(target); // you'll definitely be within range 3 because this.targetRange
	}
}
