import {Task} from './Task';

type targetType = Creep | Structure;
export class TaskRangedAttack extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('rangedAtack', target);
		// Settings
		this.taskData.moveColor = 'red';
		this.taskData.targetRange = 3;
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
