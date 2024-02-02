import {profile} from '../../profiler/decorator';
import {Task} from '../Task';


export type transferAllTargetType = StructureStorage | StructureTerminal | StructureContainer;

export const transferAllTaskName = 'transferAll';

@profile
export class TaskTransferAll extends Task<transferAllTargetType> {

	data: {
		skipEnergy?: boolean;
	};

	constructor(target: transferAllTargetType, skipEnergy = false, options = {} as TaskOptions) {
		super(transferAllTaskName, target, options);
		this.data.skipEnergy = skipEnergy;
		this.settings.blind = false;
	}

	isValidTask() {
		for (const [resourceType, amount] of this.creep.carry.contents) {
			if (this.data.skipEnergy && resourceType == RESOURCE_ENERGY) {
				continue;
			}
			if (amount > 0) {
				return true;
			}
		}
		return false;
	}

	isValidTarget() {
		return !!this.target && _.sum(this.target.store) < this.target.store.getCapacity();
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
		for (const [resourceType, amount] of this.creep.carry.contents) {
			if (this.data.skipEnergy && resourceType == RESOURCE_ENERGY) {
				continue;
			}
			if (amount > 0) {
				return this.creep.transfer(this.target, resourceType);
			}
		}
		return -1;
	}
}
