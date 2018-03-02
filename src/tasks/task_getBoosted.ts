import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type getBoostedTargetType = StructureLab;
export const getBoostedTaskName = 'getBoosted';

@profile
export class TaskGetBoosted extends Task {

	target: getBoostedTargetType;

	data: {
		amount: number | undefined;
	};

	constructor(target: getBoostedTargetType, amount: number | undefined = undefined, options = {} as TaskOptions) {
		super(getBoostedTaskName, target, options);
		// Settings
		this.data.amount = amount;
	}

	isValidTask() {
		if (this.data.amount && this.target.mineralType) {
			return this.creep.boostCounts[this.target.mineralType] <= this.data.amount;
		} else {
			return !this.creep.boosts.includes(this.target.mineralType as _ResourceConstantSansEnergy);
		}
	}

	isValidTarget() {
		return true; // Warning: this will block creep actions if the lab is left unsupplied of energy or minerals
	}

	work() {
		return this.target.boostCreep(this.creep.creep);
	}
}


