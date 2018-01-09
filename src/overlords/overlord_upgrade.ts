import {Overlord} from './Overlord';
import {UpgraderSetup} from '../creepSetup/defaultSetups';
import {TaskUpgrade} from '../tasks/task_upgrade';
import {TaskRepair} from '../tasks/task_repair';
import {TaskBuild} from '../tasks/task_build';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {Priority} from '../config/priorities';

export class UpgradingOverlord extends Overlord {

	upgraders: Zerg[];
	upgradeSite: IUpgradeSite;
	settings: { [property: string]: number };
	room: Room;	//  Operates in owned room

	constructor(upgradeSite: IUpgradeSite, priority = Priority.Normal) {
		super(upgradeSite, 'upgrade', priority);
		this.upgraders = this.getCreeps('upgrader');
		this.upgradeSite = upgradeSite;
	}

	spawn() {
		let upgradePower = _.sum(_.map(this.lifetimeFilter(this.upgraders), creep => creep.getActiveBodyparts(WORK)));
		if (upgradePower < this.upgradeSite.upgradePowerNeeded) {
			let workPartsPerUpgraderUnit = 3; // TODO: Hard-coded
			let upgraderSize = Math.ceil(this.upgradeSite.upgradePowerNeeded / workPartsPerUpgraderUnit);
			this.requestCreep(new UpgraderSetup(upgraderSize));
		}
	}

	init() {
		this.spawn();
	}

	private handleUpgrader(upgrader: Zerg): void {
		if (upgrader.carry.energy > 0) {
			if (this.upgradeSite.input) {
				if (this.upgradeSite.input.hits < this.upgradeSite.input.hitsMax) {
					upgrader.task = new TaskRepair(this.upgradeSite.input);
					return;
				}
			} else {
				if (this.upgradeSite.inputConstructionSite) {
					upgrader.task = new TaskBuild(this.upgradeSite.inputConstructionSite);
					return;
				}
			}
			upgrader.task = new TaskUpgrade(this.upgradeSite.controller);
		} else {
			// Recharge from best source
			if (this.upgradeSite.input && this.upgradeSite.input.energy > 0) {
				upgrader.task = new TaskWithdraw(this.upgradeSite.input);
			} else {
				let target = upgrader.pos.findClosestByRange(this.room.storageUnits);
				upgrader.task = new TaskWithdraw(target);
			}
		}
	}

	run() {
		for (let upgrader of this.upgraders) {
			if (upgrader.isIdle) {
				this.handleUpgrader(upgrader);
			}
			upgrader.run();
		}
	}
}
