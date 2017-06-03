import {Task} from './Task';

type targetType = Creep;
export class TaskHeal extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('heal', target);
		// Settings
		this.taskData.moveColor = 'green';
		this.taskData.targetRange = 3;
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

