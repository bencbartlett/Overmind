// Objective to supply energy to a sink
import {Objective} from './Objective';
import {supplyTargetType, TaskSupply} from '../tasks/task_supply';
import {profile} from '../lib/Profiler';

export const supplyObjectiveName = 'supply';

// Objective to supply energy to a sink
@profile
export class ObjectiveSupply extends Objective {
	target: supplyTargetType;

	constructor(target: Sink) {
		super(supplyObjectiveName, target);
		this.assignableToRoles = ['supplier', 'queen'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(CARRY) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskSupply(this.target);
	}
}
