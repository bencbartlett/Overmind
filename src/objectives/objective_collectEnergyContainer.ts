// Objective to collect energy from a container
import {Objective} from './Objective';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {profileClass} from '../profiling';

export const collectEnergyContainerObjectiveName = 'collectEnergyContainer';

export class ObjectiveCollectEnergyContainer extends Objective {
	target: Container;

	constructor(target: Container) {
		super(collectEnergyContainerObjectiveName, target);
		this.assignableToRoles = ['hauler', 'supplier'];
		this.maxCreeps = Infinity;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(CARRY) > 0 &&
			   creep.carry.energy < 0.5 * creep.carryCapacity;
	}

	getTask() {
		return new TaskWithdraw(this.target);
	}
}

profileClass(ObjectiveCollectEnergyContainer);

