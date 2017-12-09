import {Task} from './Task';
import {profileClass} from '../profiling';

export type buildTargetType = ConstructionSite;
export const buildTaskName = 'build';

export class TaskBuild extends Task {
	target: buildTargetType;

	constructor(target: buildTargetType) {
		super(buildTaskName, target);
		// Settings
		this.settings.moveColor = 'yellow';
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

profileClass(TaskBuild);
