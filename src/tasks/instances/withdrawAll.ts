/* Withdraw a resource from a target */

import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type withdrawAllTargetType = AnyStoreStructure;

export const withdrawAllTaskName = 'withdrawAll';

@profile
export class TaskWithdrawAll extends Task {

	target: withdrawAllTargetType;

	constructor(target: withdrawAllTargetType, options = {} as TaskOptions) {
		super(withdrawAllTaskName, target, options);
	}

	isValidTask() {
		return (_.sum(this.creep.carry) < this.creep.carryCapacity);
	}

	isValidTarget() {
		return _.sum(this.target.store) > 0;
	}

	work() {
		let resourceTransferType;
		for (const [resourceType, amountInStore] of this.target.store.contents) {
			if (amountInStore > 0) {
				resourceTransferType = resourceType;
				// Prioritize non-energy
				if (resourceType != RESOURCE_ENERGY) {
					break;
				}
			}
		}
		if (!!resourceTransferType) {
			return this.creep.withdraw(this.target, <ResourceConstant>resourceTransferType);
		}
		return -1;
	}

}

