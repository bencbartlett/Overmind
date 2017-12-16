// var flagCodes = require('map_flag_codes.js');
import {Task} from './Task';
import {profile} from '../lib/Profiler';


export type dismantleTargetType = Structure;
export const dismantleTaskName = 'dismantle';

@profile
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
