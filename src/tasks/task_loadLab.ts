import {Task} from './Task';

type targetType = Lab;
export class TaskLoadLab extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('loadLab', target);
		// Settings
		this.taskData.maxPerTarget = 1;
		this.taskData.moveColor = 'blue';
		this.data.resourceType = this.target.assignedMineralType; // TODO: refactor soon
	}

	isValidTask() {
		let carry = this.creep.carry[this.data.resourceType!];
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
