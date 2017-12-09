import {Task} from './Task';
import {profileClass} from '../profiling';

export type upgradeTargetType = Controller;
export const upgradeTaskName = 'upgrade';

export class TaskUpgrade extends Task {
	target: upgradeTargetType;

	constructor(target: upgradeTargetType) {
		super(upgradeTaskName, target);
		// Settings
		this.settings.targetRange = 3;
		this.settings.moveColor = 'purple';
		this.data.quiet = true;
	}

	isValidTask() {
		return (this.creep.carry.energy > 0);
	}

	isValidTarget() {
		return this.target && this.target.my;
	}

	work() {
		this.creep.sayLoop(['For', 'the swarm!', '(and GCL)']);
		return this.creep.upgradeController(this.target);
	}
}

profileClass(TaskUpgrade);
