import {Task} from './Task';
import {log} from '../lib/logger/log';
import {profileClass} from '../profiling';

export type getRenewedTargetType = Spawn;
export const getRenewedTaskName = 'getRenewed';

export class TaskGetRenewed extends Task {
	target: getRenewedTargetType;

	constructor(target: getRenewedTargetType) {
		super(getRenewedTaskName, target);
		// Settings
		this.settings.moveColor = 'cyan';
	}

	isValidTask() {
		var creep = this.creep;
		// energyAvailable requirement avoids jams where everything stops to get renewed at the same time
		let condition = creep.ticksToLive < 0.9 * creep.lifetime && creep.room.energyAvailable > 300;
		// console.log(creep.ticksToLive, creep.lifetime, condition);
		return condition;
		// this.creep.log("task" + r)
	}

	isValidTarget() {
		var target = this.target;
		let r = (target != null && target.my && target.structureType == STRUCTURE_SPAWN);
		// this.creep.log(r)
		return r;
	}

	work() {
		let response = this.target.renewCreep(this.creep.creep);
		log.debug('Renewing! ' + this.creep.ticksToLive + '/' + this.creep.lifetime);
		return response;
	}
}

profileClass(TaskGetRenewed);
