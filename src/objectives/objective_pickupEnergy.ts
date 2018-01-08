// // Objective to pick up dropped energy in a room
// import {Objective} from './Objective';
// import {TaskPickup} from '../tasks/task_pickup';
// import {profile} from '../lib/Profiler';
//
//
// export const pickupEnergyObjectiveName = 'pickupEnergy';
//
// @profile
// export class ObjectivePickupEnergy extends Objective {
// 	target: Resource;
//
// 	constructor(target: Resource) {
// 		super(pickupEnergyObjectiveName, target);
// 		this.assignableToRoles = ['hauler', 'supplier'];
// 		this.maxCreeps = 1;
// 	}
//
// 	assignableTo(creep: Zerg) {
// 		return this.assignableToRoles.includes(creep.memory.role) &&
// 			   creep.getActiveBodyparts(CARRY) > 0 &&
// 			   creep.carry.energy < creep.carryCapacity;
// 	}
//
// 	getTask() {
// 		return new TaskPickup(this.target);
// 	}
// }
