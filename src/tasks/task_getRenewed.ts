import {Task} from './Task';

type targetType = Spawn;
export class TaskGetRenewed extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('getRenewed', target);
		// Settings
		this.taskData.moveColor = 'cyan';
	}

	isValidTask() {
		var creep = this.creep;
		// energyAvailable requirement avoids jams where everything stops to get renewed at the same time
		let condition = creep.ticksToLive < 0.9 * creep.lifetime && creep.room.energyAvailable > 300; // TODO: calculate this
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
		this.creep.log('Renewing! ' + this.creep.ticksToLive + '/' + this.creep.lifetime);
		return response;
	}
}

