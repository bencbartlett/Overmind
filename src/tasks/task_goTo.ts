import {Task} from './Task';
import {profileClass} from '../profiling';

export type goToTargetType = RoomObject;
export const goToTaskName = 'goTo';

// TODO: this should accept a room position as well
export class TaskGoTo extends Task {
	target: goToTargetType;

	constructor(target: goToTargetType) {
		super(goToTaskName, target);
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
