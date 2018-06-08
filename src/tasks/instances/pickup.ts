import {Task} from '../Task';
import {profile} from '../../profiler/decorator';

export type pickupTargetType = Resource;
export const pickupTaskName = 'pickup';

@profile
export class TaskPickup extends Task {
	target: pickupTargetType;

	constructor(target: pickupTargetType, options = {} as TaskOptions) {
		super('pickup', target, options);
		this.settings.oneShot = true;
	}

	isValidTask() {
		return this.creep.carry.energy < this.creep.carryCapacity;
	}

	isValidTarget() {
		return this.target && this.target.amount > 0;
	}

	work() {
		return this.creep.pickup(this.target);
	}
}
