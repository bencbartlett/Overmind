import {Task} from './Task';
import {profile} from '../lib/Profiler';

export type getBoostedTargetType = StructureLab;
export const getBoostedTaskName = 'getBoosted';

@profile
export class TaskGetBoosted extends Task {
	target: getBoostedTargetType;

	constructor(target: getBoostedTargetType, options = {} as TaskOptions) {
		super(getBoostedTaskName, target, options);
		// Settings
		this.settings.moveColor = 'cyan';
	}

	isValidTask() {
		return false; // !(this.creep.memory.boosted && this.creep.memory.boosted[this.target.mineralType]);
	}

	isValidTarget() {
		// var target = this.target;
		return false; // (target != null && target.my && target.structureType == STRUCTURE_LAB);
	}

	work() {
		let response = this.target.boostCreep(this.creep.creep); // boostCreep takes an unwrapped creep as argument
		// if (response == OK) {
		// 	if (!this.creep.memory.boosted) {
		// 		this.creep.memory.boosted = {};
		// 	}
		// 	this.creep.memory.boosted[this.target.mineralType] = true;
		// 	this.creep.log('Boosted successfully!');
		// }
		return response;
	}
}

// TODO: fix boosting system

