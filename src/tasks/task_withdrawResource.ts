/* This is the withdrawal task for non-energy resources. */

import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type withdrawResourceTargetType = StructureStorage | StructureContainer | StructureTerminal;
export const withdrawResourceTaskName = 'withdrawResource';

@profile
export class TaskWithdrawResource extends Task {
	target: withdrawResourceTargetType;

	constructor(target: withdrawResourceTargetType, options = {} as TaskOptions) {
		super(withdrawResourceTaskName, target, options);
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
		return this.creep.withdraw(this.target, <ResourceConstant>this.data.resourceType!);
	}
}

