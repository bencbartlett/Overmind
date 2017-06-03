import {Task} from './Task';

type targetType = Lab;
export class TaskGetBoosted extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('getBoosted', target);
		// Settings
		this.taskData.moveColor = 'cyan';
	}

	isValidTask() {
		return !(this.creep.memory.boosted && this.creep.memory.boosted[this.target.mineralType]);
	}

	isValidTarget() {
		var target = this.target;
		return (target != null && target.my && target.structureType == STRUCTURE_LAB);
	}

	work() {
		let response = this.target.boostCreep(this.creep.creep); // boostCreep takes an unwrapped creep as argument
		if (response == OK) {
			if (!this.creep.memory.boosted) {
				this.creep.memory.boosted = {};
			}
			this.creep.memory.boosted[this.target.mineralType] = true;
			this.creep.log('Boosted successfully!');
		}
		return response;
	}
}
