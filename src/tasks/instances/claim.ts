import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type claimTargetType = StructureController;
export const claimTaskName = 'claim';

@profile
export class TaskClaim extends Task {
	target: claimTargetType;

	constructor(target: claimTargetType, options = {} as TaskOptions) {
		super(claimTaskName, target, options);
		// Settings
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(CLAIM) > 0);
	}

	isValidTarget() {
		return (this.target != null && (!this.target.room || !this.target.owner));
	}

	work() {
		const result = this.creep.claimController(this.target);
		if (result == OK) {
			Overmind.shouldBuild = true; // rebuild the overmind object on the next tick to account for new room
		}
		return result;
	}
}
