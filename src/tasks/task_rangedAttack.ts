import {Task} from './Task';
import {profile} from '../lib/Profiler';


export type rangedAttackTargetType = Creep | Structure;
export const rangedAttackTaskName = 'rangedAttack';

@profile
export class TaskRangedAttack extends Task {
	target: rangedAttackTargetType;

	constructor(target: rangedAttackTargetType) {
		super(rangedAttackTaskName, target);
		// Settings
		this.settings.moveColor = 'red';
		this.settings.targetRange = 3;
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(ATTACK) > 0 && (this.creep.room.hostiles.length > 0 ||
															  this.creep.room.hostileStructures.length > 0));
	}

	isValidTarget() {
		var target = this.target;
		return (target && target.hits > 0); // && target.my == false);
	}

	work() {
		return this.creep.attack(this.target);
	}
}

