import {Task} from './Task';

type targetType = Controller;
export class TaskUpgrade extends Task {
	target: targetType;

	constructor(target: targetType) {
		super('upgrade', target);
		// Settings
		this.taskData.targetRange = 3;
		this.taskData.moveColor = 'purple';
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
