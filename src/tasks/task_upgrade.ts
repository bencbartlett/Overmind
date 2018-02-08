import {Task} from './Task';
import {profile} from '../lib/Profiler';
import {controllerSignature} from '../settings/settings_user';

export type upgradeTargetType = StructureController;
export const upgradeTaskName = 'upgrade';


@profile
export class TaskUpgrade extends Task {
	target: upgradeTargetType;

	constructor(target: upgradeTargetType, options = {} as TaskOptions) {
		super(upgradeTaskName, target, options);
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
		if (Game.time % 100 == 0 && !this.target.signedByMe) {
			this.creep.signController(this.target, controllerSignature);
		}
		return this.creep.upgradeController(this.target);
	}
}

