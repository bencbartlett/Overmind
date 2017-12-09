// Objective to pick up dropped energy in a room
import {Objective} from './Objective';
import {TaskPickup} from '../tasks/task_pickup';
import {profileClass} from '../profiling';

export const pickupEnergyObjectiveName = 'pickupEnergy';

export class ObjectivePickupEnergy extends Objective {
	target: Resource;

	constructor(target: Resource) {
		super(pickupEnergyObjectiveName, target);
		this.assignableToRoles = ['hauler', 'supplier'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(CARRY) > 0 &&
			   creep.carry.energy < creep.carryCapacity;
	}

	getTask() {
		return new TaskPickup(this.target);
	}
}

profileClass(ObjectivePickupEnergy);
