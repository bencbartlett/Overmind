import {profile} from '../../profiler/decorator';
import {Task} from '../Task';


export type fortifyTargetType = StructureWall | StructureRampart;
export const fortifyTaskName = 'fortify';

@profile
export class TaskFortify extends Task {
	target: fortifyTargetType;

	constructor(target: fortifyTargetType, options = {} as TaskOptions) {
		super(fortifyTaskName, target, options);
		// Settings
		this.settings.timeout = 100; // Don't want workers to fortify indefinitely
		this.settings.targetRange = 3;
		this.settings.workOffRoad = true;
	}

	isValidTask() {
		return (this.creep.carry.energy > 0); // Times out once creep is out of energy
	}

	isValidTarget() {
		return this.target && this.target.hits < this.target.hitsMax;
	}

	work() {
		return this.creep.repair(this.target);
	}
}
