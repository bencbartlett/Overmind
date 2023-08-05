/* Withdraw a resource from a target */
import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type withdrawTargetType = AnyStoreStructure

export const withdrawTaskName = 'withdraw';

@profile
export class TaskWithdraw extends Task<withdrawTargetType> {
	data: {
		resourceType: ResourceConstant,
		amount: number | undefined,
	};

	constructor(target: withdrawTargetType,
				resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number, options = {} as TaskOptions) {
		super(withdrawTaskName, target, options);
		// Settings
		this.settings.oneShot = true;
		this.data.resourceType = resourceType;
		this.data.amount = amount;
	}

	isValidTask() {
		const amount = this.data.amount || 1;
		return (_.sum(this.creep.carry) <= this.creep.carryCapacity - amount);
	}

	isValidTarget() {
		const amount = this.data.amount || 1;
		return (this.target.store.getUsedCapacity(this.data.resourceType) || 0) >= amount;
	}

	work() {
		return this.creep.withdraw(this.target, this.data.resourceType, this.data.amount);
	}

}

