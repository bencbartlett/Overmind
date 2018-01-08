import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type goToTargetType = { pos: RoomPosition } | RoomPosition;
export const goToTaskName = 'goTo';

@profile
export class TaskGoTo extends Task {
	target: null;

	constructor(target: goToTargetType, options = {} as TaskOptions) {
		if (target instanceof RoomPosition) {
			super(goToTaskName, {ref: null, pos: target}, options);
		} else {
			super(goToTaskName, {ref: null, pos: target.pos}, options);
		}
		// Settings
		this.settings.targetRange = 1;
	}

	isValidTask() {
		return !this.creep.pos.inRangeTo(this.targetPos, this.settings.targetRange);
	}

	isValidTarget() {
		return true;
	}

	isValid(): boolean {
		let validTask = false;
		if (this.creep) {
			validTask = this.isValidTask();
		}
		// Return if the task is valid; if not, finalize/delete the task and return false
		if (validTask) {
			return true;
		} else {
			// Switch to parent task if there is one
			this.finish();
			if (this.creep.task) {  // return whether parent task is valid if there is one
				return this.creep.task.isValid();
			} else {
				return false;
			}
		}
	}

	work() {
		return OK;
	}

}
