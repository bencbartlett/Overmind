/* This is the task for withdrawing energy. For withdrawing other resources, see taskWithdrawResource. */

import {Task} from './Task';

type targetType = StructureStorage | StructureContainer | StructureTerminal | StructureLink;
export class TaskWithdraw extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('recharge', target);
		// Settings
		this.taskData.moveColor = 'blue';
	}

	isValidTask() {
		return _.sum(this.creep.carry) < this.creep.carryCapacity;
	}

	isValidTarget() {
		return this.target && this.target.energy > 0;
	}

	work() {
		return this.creep.withdraw(this.target, RESOURCE_ENERGY);
	}
}
