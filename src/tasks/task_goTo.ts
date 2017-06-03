import {Task} from './Task';

type targetType = RoomObject;
export class TaskGoTo extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('goTo', target);
		// Settings
		this.taskData.targetRange = 1;
	}

	isValidTask() {
		return !this.creep.pos.inRangeTo(this.targetPos, this.taskData.targetRange);
	}

	isValidTarget() {
		return this.target != null;
	}

	work() {
		return OK;
	}
}
