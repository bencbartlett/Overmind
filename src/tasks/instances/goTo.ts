import {hasPos} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

// export type goToTargetType = { pos: RoomPosition } | RoomPosition;
export type goToTargetType = HasRef & HasPos;  // This is overridden and handled better in the Tasks.goTo() dispatcher
export const goToTaskName = 'goTo';

@profile
export class TaskGoTo extends Task<goToTargetType> {

	constructor(target: goToTargetType, options = {} as TaskOptions) {
		super(goToTaskName, {ref: '', pos: target.pos}, options);
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
			let isValid = false;
			if (this.parent) {
				isValid = this.parent.isValid();
			}
			this.finish();
			return isValid;
		}
	}

	work() {
		return OK;
	}

}
