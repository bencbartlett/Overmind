// Objective to build a road site

import {Objective} from './Objective';
import {TaskBuild} from '../tasks/task_build';
import {profile} from '../lib/Profiler';

export const buildRoadObjectiveName = 'buildRoad';

@profile
export class ObjectiveBuildRoad extends Objective {
	target: ConstructionSite;

	constructor(target: ConstructionSite) {
		super('buildRoad', target);
		this.assignableToRoles = ['worker'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(WORK) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskBuild(this.target);
	}
}
