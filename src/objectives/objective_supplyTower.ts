// Objective to supply energy to a tower
import {Objective} from './Objective';
import {TaskSupply} from '../tasks/task_supply';
import {profile} from '../lib/Profiler';

export const supplyTowerObjectiveName = 'supplyTower';

@profile
export class ObjectiveSupplyTower extends Objective {
	target: StructureTower;

	constructor(target: StructureTower) {
		super(supplyTowerObjectiveName, target);
		this.assignableToRoles = ['supplier', 'queen'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(CARRY) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskSupply(this.target);
	}
}
