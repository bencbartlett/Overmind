import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type pickupTargetType = Resource;
export const pickupTaskName = 'pickup';

@profile
export class TaskPickup extends Task {
	target: pickupTargetType;

	constructor(target: pickupTargetType, options = {} as TaskOptions) {
		super('pickup', target, options);
		// Settings
		this.settings.moveColor = 'yellow';
	}

	isValidTask() {
		return this.creep.carry.energy < this.creep.carryCapacity;
	}

	isValidTarget() {
		return this.target && this.target.amount > 0;
	}

	work() {
		// let res =
		// if (!this.target) { // if the target is gone, we're done and clear the task
		// 	this.finish();
		// }
		return this.creep.pickup(this.target);
	}
}
