import {Task} from './Task';

type targetType = ConstructionSite;

export class TaskBuild extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('build', target);
		// Settings
		this.taskData.maxPerTarget = 3;
		this.taskData.targetRange = 3;
		this.taskData.moveColor = 'yellow';
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		let target = this.target;
		return target && target.my && target.progress < target.progressTotal;
	}

	work() {
		return this.creep.build(this.target);
	}
}
