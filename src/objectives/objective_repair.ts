// Objective to repair a structure
import {Objective} from './Objective';
import {TaskRepair} from '../tasks/task_repair';
import {profileClass} from '../profiling';

export const repairObjectiveName = 'repair';

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

profileClass(ObjectiveRepair);
