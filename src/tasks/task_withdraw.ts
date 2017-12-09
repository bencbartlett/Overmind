/* This is the task for withdrawing energy. For withdrawing other resources, see taskWithdrawResource. */

import {Task} from './Task';
import {profileClass} from '../profiling';

export type withdrawTargetType = StructureStorage | StructureContainer | StructureTerminal | StructureLink;
export const withdrawTaskName = 'recharge';

export class TaskWithdraw extends Task {
	target: withdrawTargetType;

	constructor(target: withdrawTargetType) {
		super(withdrawTaskName, target);
		// Settings
		this.settings.moveColor = 'blue';
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

profileClass(TaskWithdraw);
