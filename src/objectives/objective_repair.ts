// Objective to repair a structure
import {Objective} from './Objective';
import {TaskRepair} from '../tasks/task_repair';
import {profile} from '../lib/Profiler';

export const repairObjectiveName = 'repair';

@profile
export class ObjectiveRepair extends Objective {
	target: Structure;

	constructor(target: Structure) {
		super(repairObjectiveName, target);
		this.assignableToRoles = ['worker', 'miner'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(WORK) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskRepair(this.target);
	}
}
