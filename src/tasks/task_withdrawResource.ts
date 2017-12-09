/* This is the withdrawal task for non-energy resources. */

import {Task} from './Task';
import {profileClass} from '../profiling';

export type withdrawResourceTargetType = StructureStorage | StructureContainer | StructureTerminal;
export const withdrawResourceTaskName = 'withdrawResource';

export class TaskWithdrawResource extends Task {
	target: withdrawResourceTargetType;

	constructor(target: withdrawResourceTargetType) {
		super(withdrawResourceTaskName, target);
		// Settings
		this.settings.moveColor = 'blue';
		this.data.resourceType = undefined; // this needs to be overwritten on assignment
	}

	isValidTask() {
		var creep = this.creep;
		return (_.sum(creep.carry) < creep.carryCapacity);
	}

	isValidTarget() {
		let target = this.target;
		if (target) {
			let amount = target.store[<ResourceConstant>this.data.resourceType!];
			if (amount) {
				return amount > 0;
			}
		}
		return false;
	}

	work() {
		return this.creep.withdraw(this.target, this.data.resourceType!);
	}
}

profileClass(TaskWithdrawResource);
