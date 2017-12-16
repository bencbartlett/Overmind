import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type supplyTargetType = Sink;
export const supplyTaskName = 'supply';

@profile
export class TaskSupply extends Task {
	target: supplyTargetType;

	constructor(target: supplyTargetType) {
		super(supplyTaskName, target);
		// Settings
		this.settings.moveColor = 'blue';
		this.data.quiet = true;
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		return this.target && !this.target.isFull;
	}

	work() {
		return this.creep.transfer(this.target, RESOURCE_ENERGY);
	}
}

