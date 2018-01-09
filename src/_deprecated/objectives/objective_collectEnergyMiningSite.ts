// // Objective to collect energy from a container that is part of a mining site
//
// import {Objective} from './Objective';
// import {TaskWithdraw} from '../tasks/task_withdraw';
// import {profile} from '../lib/Profiler';
//
// export const collectEnergyMiningSiteObjectiveName = 'collectEnergyMiningSite';
//
// @profile
// export class ObjectiveCollectEnergyMiningSite extends Objective {
// 	target: StructureContainer;
//
// 	constructor(target: StructureContainer) {
// 		super('collectEnergyMiningSite', target);
// 		this.assignableToRoles = ['hauler', 'supplier'];
// 		this.maxCreeps = Infinity;
// 	}
//
// 	assignableTo(creep: Zerg) {
// 		return this.assignableToRoles.includes(creep.memory.role) &&
// 			   this.target.miningSite.predictedStore >= 0.75 * (creep.carryCapacity - _.sum(creep.carry)) &&
// 			   creep.getActiveBodyparts(CARRY) > 0;
// 	}
//
// 	getTask() {
// 		return new TaskWithdraw(this.target);
// 	}
// }
