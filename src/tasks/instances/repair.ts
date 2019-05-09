import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type repairTargetType = Structure;
export const repairTaskName = 'repair';

@profile
export class TaskRepair extends Task {
	target: repairTargetType;

	constructor(target: repairTargetType, options = {} as TaskOptions) {
		super(repairTaskName, target, options);
		// Settings
		this.settings.timeout = 100;
		this.settings.targetRange = 3;
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		return this.target && this.target.hits < this.target.hitsMax;
	}

	work() {
		const result = this.creep.repair(this.target);
		if (this.target.structureType == STRUCTURE_ROAD) {
			// prevents workers from idling for a tick before moving to next target
			const newHits = this.target.hits + this.creep.getActiveBodyparts(WORK) * REPAIR_POWER;
			if (newHits > this.target.hitsMax) {
				this.finish();
			}
		}
		return result;
	}
}
