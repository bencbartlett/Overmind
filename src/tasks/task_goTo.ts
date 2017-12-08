import {Task} from './Task';
import {profileClass} from '../profiling';

type targetType = RoomObject;

// TODO: this should accept a room position as well
export class TaskGoTo extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('goTo', target);
		// Settings
		this.settings.targetRange = 1;
	}

	isValidTask() {
		return !this.creep.pos.inRangeTo(this.targetPos, this.settings.targetRange);
	}

	isValidTarget() {
		return this.target != null;
	}

	work() {
		return OK;
	}
}

profileClass(TaskGoTo);
