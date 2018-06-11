import {Task} from '../Task';
import {profile} from '../../profiler/decorator';

export type harvestTargetType = Source | Mineral;
export const harvestTaskName = 'harvest';

@profile
export class TaskHarvest extends Task {
	target: harvestTargetType;

	constructor(target: harvestTargetType, options = {} as TaskOptions) {
		super(harvestTaskName, target, options);
	}

	isValidTask() {
		return _.sum(this.creep.carry) < this.creep.carryCapacity;
	}

	isValidTarget() {
		if (this.target && (this.target instanceof Source ? this.target.energy > 0 : this.target.mineralAmount > 0)) {
			// Valid only if there's enough space for harvester to work - prevents doing tons of useless pathfinding
			return this.target.pos.availableNeighbors().length > 0 || this.creep.pos.isNearTo(this.target.pos);
		}
		return false;
	}

	work() {
		return this.creep.harvest(this.target);
	}
}

