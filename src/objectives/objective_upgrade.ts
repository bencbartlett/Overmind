// Objective to upgrade the controller
import {Objective} from './Objective';
import {TaskUpgrade} from '../tasks/task_upgrade';
import {profile} from '../lib/Profiler';

export const upgradeObjectiveName = 'upgrade';

@profile
export class ObjectiveUpgrade extends Objective {
	target: StructureController;

	constructor(target: StructureController) {
		super(upgradeObjectiveName, target);
		this.assignableToRoles = ['upgrader', 'worker'];
		this.maxCreeps = Infinity;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(WORK) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskUpgrade(this.target);
	}
}
