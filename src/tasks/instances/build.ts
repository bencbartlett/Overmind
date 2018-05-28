import {Task} from '../Task';
import {profile} from '../../profiler/decorator';

export type buildTargetType = ConstructionSite;
export const buildTaskName = 'build';

@profile
export class TaskBuild extends Task {
	target: buildTargetType;

	constructor(target: buildTargetType, options = {} as TaskOptions) {
		super(buildTaskName, target, options);
		// Settings
		this.settings.targetRange = 3;
		this.settings.workOffRoad = true;
	}

	isValidTask() {
		return this.creep.carry.energy > 0;
	}

	isValidTarget() {
		return this.target && this.target.my && this.target.progress < this.target.progressTotal;
	}

	work() {
		return this.creep.build(this.target);
	}
}
