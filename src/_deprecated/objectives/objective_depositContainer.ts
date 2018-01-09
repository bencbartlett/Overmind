// // Objective to deposit energy to a container
//
// import {Objective} from './Objective';
// import {TaskDeposit} from '../tasks/task_deposit';
// import {profile} from '../lib/Profiler';
//
//
// export const depositContainerObjectiveName = 'depositContainer';
//
// @profile
// export class ObjectiveDepositContainer extends Objective {
//
// 	target: StructureContainer;
//
// 	constructor(target: StructureContainer) {
// 		super(depositContainerObjectiveName, target);
// 		this.assignableToRoles = ['supplier', 'queen'];
// 		this.maxCreeps = 1;
// 	}
//
// 	assignableTo(creep: Zerg) {
// 		return this.assignableToRoles.includes(creep.memory.role) &&
// 			   creep.getActiveBodyparts(CARRY) > 0 &&
// 			   creep.carry.energy > 0;
// 	}
//
// 	getTask() {
// 		return new TaskDeposit(this.target);
// 	}
// }
