import {Task} from '../Task';
import {profile} from '../../profiler/decorator';

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
		if (this.target instanceof StructureRoad) {
			// Move toward target if it's a road to prevent move-stop-repair-move-stop-repair
			this.move(this.settings.targetRange - 1);
		}
		return this.creep.repair(this.target);
	}
}
