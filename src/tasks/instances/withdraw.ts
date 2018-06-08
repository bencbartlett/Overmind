/* Withdraw a resource from a target */

import {Task} from '../Task';
import {profile} from '../../profiler/decorator';
import {EnergyStructure, isEnergyStructure, isStoreStructure, StoreStructure} from '../../declarations/typeGuards';

export type withdrawTargetType =
	EnergyStructure
	| StoreStructure
	| StructureLab
	| StructureNuker
	| StructurePowerSpawn
	| Tombstone;

export const withdrawTaskName = 'withdraw';

@profile
export class TaskWithdraw extends Task {

	target: withdrawTargetType;
	data: {
		resourceType: ResourceConstant,
		amount: number | undefined,
	};

	constructor(target: withdrawTargetType,
				resourceType: ResourceConstant = RESOURCE_ENERGY,
				amount: number | undefined     = undefined,
				options                        = {} as TaskOptions) {
		super(withdrawTaskName, target, options);
		// Settings
		this.settings.oneShot = true;
		this.data.resourceType = resourceType;
		this.data.amount = amount;
	}

	isValidTask() {
		let amount = this.data.amount || 1;
		return (_.sum(this.creep.carry) <= this.creep.carryCapacity - amount);
	}

	isValidTarget() {
		let amount = this.data.amount || 1;
		let target = this.target;
		if (target instanceof Tombstone || isStoreStructure(target)) {
			return (target.store[this.data.resourceType] || 0) >= amount;
		} else if (isEnergyStructure(target) && this.data.resourceType == RESOURCE_ENERGY) {
			return target.energy >= amount;
		} else {
			if (target instanceof StructureLab) {
				return this.data.resourceType == target.mineralType && target.mineralAmount >= amount;
			} else if (target instanceof StructureNuker) {
				return this.data.resourceType == RESOURCE_GHODIUM && target.ghodium >= amount;
			} else if (target instanceof StructurePowerSpawn) {
				return this.data.resourceType == RESOURCE_POWER && target.power >= amount;
			}
		}
		return false;
	}

	work() {
		this.moveToNextPos();
		return this.creep.withdraw(this.target, this.data.resourceType, this.data.amount);
	}

}

