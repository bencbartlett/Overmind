import {Task} from './Task';
import {profile} from '../profiler/decorator';

export type dropTargetType = { pos: RoomPosition } | RoomPosition;
export const dropTaskName = 'drop';

@profile
export class TaskDrop extends Task {

	target: null;

	constructor(target: dropTargetType, options = {} as TaskOptions) {
		if (target instanceof RoomPosition) {
			super(dropTaskName, {ref: '', pos: target}, options);
		} else {
			super(dropTaskName, {ref: '', pos: target.pos}, options);
		}
		// Settings
		this.settings.targetRange = 0;
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
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
				let isValid = this.parent.isValid();
			}
			this.finish();
			return isValid;
		}
	}

	work() {
		// let res =
		// if (!this.target) { // if the target is gone, we're done and clear the task
		// 	this.finish();
		// }
		return this.creep.drop(RESOURCE_ENERGY);
	}
}
