import {Task} from './Task';

type targetType = RoomObject;
export class TaskGoToRoom extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('goToRoom', target);
		// Settings
		this.taskData.targetRange = 2; // Target is almost always controller flag, so range of 2 is acceptable
	}

	isValidTask() {
		let creep = this.creep;
		return !(creep.pos.roomName == this.target.roomName &&
				 creep.pos.x > 0 && creep.pos.x < 49 &&
				 creep.pos.y > 0 && creep.pos.y < 49);
	}

	isValidTarget() {
		return true;
	}

	work() {
		return OK;
	}
}
