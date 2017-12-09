import {Task} from './Task';
import {profileClass} from '../profiling';

export type loadLabTargetType = Lab;
export const loadLabTaskName = 'loadLab';

export class TaskLoadLab extends Task {
	target: loadLabTargetType;

	constructor(target: loadLabTargetType) {
		super(loadLabTaskName, target);
		// Settings
		this.settings.moveColor = 'blue';
		this.data.resourceType = this.target.assignedMineralType; // TODO: refactor soon
	}

	isValidTask() {
		let carry = this.creep.carry[<ResourceConstant>this.data.resourceType!];
		if (carry) {
			return carry > 0;
		} else {
			return false;
		}
	}

	isValidTarget() {
		let target = this.target;
		if (target && target.structureType == STRUCTURE_LAB) {
			return (target.mineralAmount < target.mineralCapacity);
		} else {
			return false;
		}
	}

	work() {
		return this.creep.transfer(this.target, this.data.resourceType!);
	}
}

profileClass(TaskLoadLab);
