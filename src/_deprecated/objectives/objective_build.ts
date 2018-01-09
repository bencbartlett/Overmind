// // Objective to build a construction site
//
// import {Objective} from './Objective';
// import {TaskBuild} from '../tasks/task_build';
// import {profile} from '../lib/Profiler';
//
// export const buildObjectiveName = 'build';
//
// @profile
// export class ObjectiveBuild extends Objective {
// 	target: ConstructionSite;
//
// 	constructor(target: ConstructionSite) {
// 		super(buildObjectiveName, target);
// 		this.assignableToRoles = ['worker', 'miner'];
// 		this.maxCreeps = 3;
// 	}
//
// 	assignableTo(creep: Zerg) {
// 		return this.assignableToRoles.includes(creep.memory.role) &&
// 			   creep.getActiveBodyparts(WORK) > 0 &&
// 			   creep.carry.energy > 0;
// 	}
//
// 	getTask() {
// 		return new TaskBuild(this.target);
// 	}
// }
