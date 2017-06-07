import {Task} from './Task';

type targetType = StructureContainer | StructureStorage | StructureTerminal |
	StructureLab | StructureNuker | StructurePowerSpawn;

export class TaskTransfer extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('transfer', target);
		// Settings
		this.taskData.moveColor = 'blue';
		this.data.resourceType = undefined; // this needs to be overwritten before assignment
	}

	isValidTask() {
		let carry = this.creep.carry[this.data.resourceType!]; // TODO: refactor
		if (carry) {
			return carry > 0;
		} else {
			return false;
		}
	}

	isValidTarget() {
		var target = this.target;
		if (target.structureType == STRUCTURE_CONTAINER ||
			target.structureType == STRUCTURE_STORAGE ||
			target.structureType == STRUCTURE_TERMINAL) {
			let t = target as StructureContainer | StructureStorage | StructureTerminal;
			return (_.sum(t.store) < t.storeCapacity);
		} else if (target.structureType == STRUCTURE_LAB) {
			let t = target as StructureLab;
			return t.mineralAmount < t.mineralCapacity;
		} else if (target.structureType == STRUCTURE_NUKER) {
			let t = target as StructureNuker;
			return t.ghodium < t.ghodiumCapacity;
		} else if (target.structureType == STRUCTURE_POWER_SPAWN) {
			let t = target as StructurePowerSpawn;
			return t.power < t.powerCapacity;
		} else {
			return false;
		}
	}

	work() {
		return this.creep.transfer(this.target, this.data.resourceType!);
	}
}
