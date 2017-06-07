// Worker creep - combines repairer, builder, and upgrader functionality

import {AbstractCreep, AbstractSetup} from './Abstract';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskPickup} from '../tasks/task_pickup';

export class WorkerSetup extends AbstractSetup {
	constructor() {
		super('worker');
		// Role-specific settings
		this.settings.bodyPattern = [WORK, CARRY, MOVE];
		this.settings.notifyOnNoTask = true;
		this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(WORK) > 1 &&
												  creep.getActiveBodyparts(MOVE) > 1 &&
												  creep.getActiveBodyparts(CARRY) > 1;
	}
}

export class WorkerCreep extends AbstractCreep {
	constructor(creep: Creep) {
		super(creep);
	}

	/* Default logic for a worker-type creep to refill its energy supply */
	recharge(): void { // default recharging logic for creeps
		// Allowing workers to recharge from dropped energy lets you move storage
		let possibleTargets: (StructureContainer | StructureStorage | Resource)[] = [];
		possibleTargets = possibleTargets.concat(this.room.storageUnits, this.room.droppedEnergy);
		let target = this.pos.findClosestByRange(possibleTargets, {
			filter: (s: StorageUnit | Resource) =>
			(s instanceof Resource && s.amount > this.carryCapacity) ||
			(s instanceof StructureContainer && s.energy > this.carryCapacity) ||
			(s instanceof StructureStorage && s.creepCanWithdrawEnergy(this))
		}) as Resource | StructureContainer | StructureStorage;
		if (target) { // assign recharge task to creep
			if (target instanceof Resource) {
				this.task = new TaskPickup(target);
			} else {
				this.task = new TaskWithdraw(target);
			}
		} else {
			this.say('Can\'t recharge');
		}
	}

	// onRun(creep: Creep) {
	//     if (creep.colony.incubating) {
	//         // only harvest if there are miners away from their stations
	//         this.settings.workersCanHarvest =
	//             creep.room.find(FIND_MY_CREEPS, { // are all sources are occupied by miners?
	//                 filter: (c: Creep) => c.memory.role == 'miner' && // is there a miner?
	//                                       c.pos.findInRange(FIND_SOURCES, 1).length > 0 // is it at its source?
	//             }).length < creep.room.sources.length ||
	//             creep.room.containers.length < creep.room.sources.length; // or are there not containers yet?
	//         this.renewIfNeeded(creep);
	//     }
	//     // if a creep is trying to harvest and isn't getting any energy and a container becomes available, stop harvest
	//     if (creep.task && creep.task.name == 'harvest' && creep.pos.findInRange(FIND_SOURCES, 1).length == 0) {
	//         if (_.filter(creep.room.storageUnits, (s: StructureContainer | StructureStorage) =>
	//                      (s.structureType == STRUCTURE_CONTAINER
	//                       && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
	//                      (s.structureType == STRUCTURE_STORAGE
	//                       && s.store[RESOURCE_ENERGY] > creep.colony.overlord.settings.storageBuffer['worker']),
	//             ).length > 0) {
	//             creep.task = null;
	//         }
	//     }
	// }
}
