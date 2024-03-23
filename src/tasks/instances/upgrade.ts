import {profile} from '../../profiler/decorator';
import {Task} from '../Task';

export type upgradeTargetType = StructureController;
export const upgradeTaskName = 'upgrade';


@profile
export class TaskUpgrade extends Task<upgradeTargetType> {

	constructor(target: upgradeTargetType, options = {} as TaskOptions) {
		super(upgradeTaskName, target, options);
		// Settings
		this.settings.targetRange = 3;
		this.settings.workOffRoad = true;
	}

	isValidTask() {
		return (this.creep.store.energy > 0);
	}

	isValidTarget() {
		return !!this.target && !!this.target.my;
	}

	work() {
		if (!this.target) return ERR_INVALID_TARGET;
		return this.creep.upgradeController(this.target);
	}
}

