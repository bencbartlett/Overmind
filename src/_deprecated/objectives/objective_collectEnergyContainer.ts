// // Objective to collect energy from a container
// import {Objective} from './Objective';
// import {TaskWithdraw} from '../tasks/task_withdraw';
// import {profile} from '../lib/Profiler';
//
// export const collectEnergyContainerObjectiveName = 'collectEnergyContainer';
//
// @profile
// export class ObjectiveCollectEnergyContainer extends Objective {
// 	target: StructureContainer;
//
// 	constructor(target: StructureContainer) {
// 		super(collectEnergyContainerObjectiveName, target);
// 		this.assignableToRoles = ['hauler', 'supplier'];
// 		this.maxCreeps = Infinity;
// 	}
//
// 	assignableTo(creep: Zerg) {
// 		return this.assignableToRoles.includes(creep.memory.role) &&
// 			   creep.getActiveBodyparts(CARRY) > 0 &&
// 			   creep.carry.energy < 0.5 * creep.carryCapacity;
// 	}
//
// 	getTask() {
// 		return new TaskWithdraw(this.target);
// 	}
// }
//
