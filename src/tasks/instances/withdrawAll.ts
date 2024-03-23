/* Withdraw a resource from a target */

import {profile} from '../../profiler/decorator';
import {Task} from '../Task';
import {withdrawTargetType} from './withdraw';

export type withdrawAllTargetType = AnyStoreStructure;

export const withdrawAllTaskName = 'withdrawAll';

@profile
export class TaskWithdrawAll extends Task<withdrawTargetType> {


	constructor(target: withdrawAllTargetType, options = {} as TaskOptions) {
		super(withdrawAllTaskName, target, options);
		this.settings.blind = true;
	}

	isValidTask() {
		return (this.creep.store.getUsedCapacity() < this.creep.store.getCapacity());
	}

	isValidTarget() {
		return !!this.target && (this.target.store.getUsedCapacity() ?? 0) > 0;
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
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

