// var flagCodes = require('map_flag_codes.js');
import {Task} from './Task';
import {profileClass} from '../profiling';

export type dismantleTargetType = Structure;
export const dismantleTaskName = 'dismantle';

export class TaskDismantle extends Task {
	target: dismantleTargetType;

	constructor(target: dismantleTargetType) {
		super(dismantleTaskName, target);
		// Settings
		this.settings.moveColor = 'red';
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(WORK) > 0);
	}

	isValidTarget() {
		let target = this.target;
		return target && target.hits > 0;
	}

	work() {
		return this.creep.dismantle(this.target);
	}
}

profileClass(TaskDismantle);
