// Objective to collect energy from a container that is part of a mining site

import {Objective} from './Objective';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {profileClass} from '../profiling';

export const collectEnergyMiningSiteObjectiveName = 'collectEnergyMiningSite';

export class ObjectiveCollectEnergyMiningSite extends Objective {
	target: Container;

	constructor(target: Container) {
		super('collectEnergyMiningSite', target);
		this.assignableToRoles = ['hauler', 'supplier'];
		this.maxCreeps = Infinity;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   this.target.miningSite.predictedStore >= 0.75 * (creep.carryCapacity - _.sum(creep.carry)) &&
			   creep.getActiveBodyparts(CARRY) > 0;
	}

	getTask() {
		return new TaskWithdraw(this.target);
	}
}

profileClass(ObjectiveCollectEnergyMiningSite);

