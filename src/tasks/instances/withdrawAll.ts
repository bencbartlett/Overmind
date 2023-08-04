/* Withdraw a resource from a target */

import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type withdrawAllTargetType = AnyStoreStructure;

export const withdrawAllTaskName = 'withdrawAll';

@profile
export class TaskWithdrawAll extends Task<withdrawAllTargetType> {
	constructor(target: withdrawAllTargetType, options = {} as TaskOptions) {
		super(withdrawAllTaskName, target, options);
	}

	isValidTask() {
		return (this.creep.store.getUsedCapacity() < this.creep.store.getCapacity());
	}

	isValidTarget() {
		return (this.target.store.getUsedCapacity() || 0) > 0;
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

