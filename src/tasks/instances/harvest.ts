import {isSource} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type harvestTargetType = Source | Mineral;
export const harvestTaskName = 'harvest';

@profile
export class TaskHarvest extends Task<harvestTargetType> {

	constructor(target: harvestTargetType, options = {} as TaskOptions) {
		super(harvestTaskName, target, options);
	}

	isValidTask() {
		return _.sum(this.creep.carry) < this.creep.carryCapacity;
	}

	isValidTarget() {
		if (!this.target) return false;
		if (isSource(this.target)) {
			return this.target.energy > 0;
		} else {
			return this.target.mineralAmount > 0;
		}
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
		return this.creep.harvest(this.target);
	}
}

