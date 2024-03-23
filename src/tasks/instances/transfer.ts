import {profile} from '../../profiler/decorator';
import {Task} from '../Task';


export type transferTargetType =
	TransferrableStoreStructure
	| Creep;

export const transferTaskName = 'transfer';

@profile
export class TaskTransfer extends Task<transferTargetType> {

	data: {
		resourceType: ResourceConstant
		amount: number | undefined
	};

	constructor(target: transferTargetType,
				resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number, options = {} as TaskOptions) {
		super(transferTaskName, target, options);
		// Settings
		this.settings.oneShot = true;
		this.settings.blind = true;
		this.data.resourceType = resourceType;
		this.data.amount = amount;
	}

	isValidTask() {
		const amount = this.data.amount || 1;
		const resourcesInCarry = this.creep.store[this.data.resourceType] || 0;
		return resourcesInCarry >= amount;
	}

	isValidTarget() {
		const amount = this.data.amount || 1;
		// TODO: if you don't have vision of the creep (transferring to other creep?)
		return !!this.target && (this.target.store.getFreeCapacity(this.data.resourceType) ?? 0) >= amount;


		// LEGACY:

		// const target = this.target;
		// if (target instanceof Creep) {
		// 	return _.sum(target.carry) <= target.carryCapacity - amount;
		// } else if (isStoreStructure(target)) {
		// 	return _.sum(target.store) <= target.storeCapacity - amount;
		// } else if (isEnergyStructure(target) && this.data.resourceType == RESOURCE_ENERGY) {
		// 	return target.energy <= target.energyCapacity - amount;
		// } else {
		// 	if (target instanceof StructureLab) {
		// 		return (target.mineralType == this.data.resourceType || !target.mineralType) &&
		// 			   target.mineralAmount <= target.mineralCapacity - amount;
		// 	} else if (target instanceof StructureNuker) {
		// 		return this.data.resourceType == RESOURCE_GHODIUM &&
		// 			   target.ghodium <= target.ghodiumCapacity - amount;
		// 	} else if (target instanceof StructurePowerSpawn) {
		// 		return this.data.resourceType == RESOURCE_POWER &&
		// 			   target.power <= target.powerCapacity - amount;
		// 	}
		// }
		// return false;
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
		return this.creep.transfer(this.target, this.data.resourceType, this.data.amount);
	}
}
