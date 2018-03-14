import {Task} from './Task';
import {profile} from '../lib/Profiler';
import {EnergyStructure, isEnergyStructure, StoreStructure} from '../declarations/typeGuards';

export type depositTargetType = StructureLink | EnergyStructure | StoreStructure;
export const depositTaskName = 'deposit';

@profile
export class TaskDeposit extends Task {
	target: depositTargetType;

	constructor(target: depositTargetType, options = {} as TaskOptions) {
		super(depositTaskName, target, options);
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		let target = this.target;
		if (target instanceof StructureLink) {
			// This allows for a "double deposit": deposit, transmit, deposit
			return target.energy < target.energyCapacity || target.cooldown == 0;
		} else if (isEnergyStructure(target)) {
			return target.energy < target.energyCapacity;
		} else {
			return _.sum(target.store) < target.storeCapacity;
		}
	}

	work() {
		return this.creep.transfer(this.target, RESOURCE_ENERGY);
	}
}


