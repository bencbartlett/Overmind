import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type claimTargetType = StructureController;
export const claimTaskName = 'claim';

@profile
export class TaskClaim extends Task<claimTargetType> {

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
		if (!this.target) {
			return ERR_INVALID_TARGET;
		}
		return this.creep.claimController(this.target);
	}
}
