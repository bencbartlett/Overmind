// Upgrader creep - sits and upgrades spawn
import {TaskGetBoosted} from '../tasks/task_getBoosted';
import {TaskSignController} from '../tasks/task_signController';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {AbstractCreep, AbstractSetup} from './Abstract';
import {controllerSignature} from '../settings/settings_user';
import {TaskUpgrade} from '../tasks/task_upgrade';

export class UpgraderSetup extends AbstractSetup {
	constructor() {
		super('upgrader');
		// Role-specific settings
		this.settings.bodyPattern = [WORK, WORK, WORK, CARRY, MOVE];
		this.settings.signature = controllerSignature;
		this.settings.consoleQuiet = true;
		this.settings.sayQuiet = true;
		this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(WORK) > 1 &&
												  creep.getActiveBodyparts(MOVE) > 1 &&
												  creep.getActiveBodyparts(CARRY) > 1;
	}
}


export class UpgraderCreep extends AbstractCreep {
	assignment: StructureController;
	upgradeSite: IUpgradeSite;

	constructor(creep: Creep) {
		super(creep);
	}

	init() {
		this.upgradeSite = this.colony.upgradeSite;
	}

	rechargeFromInput() {
		if (this.upgradeSite.input && this.upgradeSite.input.energy > 0) {
			this.task = new TaskWithdraw(this.upgradeSite.input);
		} else {
			this.recharge();
		}
	}

	onRun() {
		if (!this.memory.boosted) { // get boosted if you aren't already
			let upgraderBoosters = _.filter(this.room.labs, (lab: StructureLab) =>
											lab.assignedMineralType == RESOURCE_CATALYZED_GHODIUM_ACID &&
											lab.mineralAmount >= 30 * this.getActiveBodyparts(WORK),
			);
			if (upgraderBoosters.length > 0 && this.ticksToLive > 0.95 * this.lifetime) {
				this.task = new TaskGetBoosted(upgraderBoosters[0]);
			}
		} else if (this.room.controller!.signedByMe) {
			this.task = new TaskSignController(this.room.controller!);
		}
	}

	newTask() {
		this.task = null;
		if (this.carry.energy == 0) {
			this.rechargeFromInput();
		} else {
			this.task = new TaskUpgrade(this.upgradeSite.controller);
		}
	}

}
