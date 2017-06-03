import {Task} from './Task';

type targetType = StructureWall | Rampart;
export class TaskFortify extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('fortify', target);
		// Settings
		this.taskData.maxPerTarget = 1;
		this.taskData.targetRange = 3;
		this.taskData.moveColor = 'green';
	}

	isValidTask() {
		return (this.creep.carry.energy > 0);
	}

	isValidTarget() {
		let target = this.target;
		return (target != null && target.hits < target.hitsMax); // over-fortify to minimize extra trips
	}

	work() {
		return this.creep.repair(this.target);
	}
}
