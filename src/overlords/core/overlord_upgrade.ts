import {Overlord} from '../Overlord';
import {UpgraderSetup} from '../../creepSetup/defaultSetups';
import {UpgradeSite} from '../../hiveClusters/hiveCluster_upgradeSite';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../priorities_overlords';

export class UpgradingOverlord extends Overlord {

	upgraders: Zerg[];
	upgradeSite: UpgradeSite;
	settings: { [property: string]: number };
	room: Room;	//  Operates in owned room

	constructor(upgradeSite: UpgradeSite, priority = OverlordPriority.ownedRoom.upgrade) {
		super(upgradeSite, 'upgrade', priority);
		this.upgraders = this.creeps('upgrader');
		this.upgradeSite = upgradeSite;
	}

	init() {
		let upgradePower = _.sum(_.map(this.lifetimeFilter(this.upgraders), creep => creep.getActiveBodyparts(WORK)));
		if (upgradePower < this.upgradeSite.upgradePowerNeeded) {
			let workPartsPerUpgraderUnit = 3; // TODO: Hard-coded
			let upgraderSize = Math.ceil(this.upgradeSite.upgradePowerNeeded / workPartsPerUpgraderUnit);
			this.requestCreep(new UpgraderSetup(upgraderSize));
		}
		this.creepReport(UpgraderSetup.role, upgradePower, this.upgradeSite.upgradePowerNeeded);
	}

	private handleUpgrader(upgrader: Zerg): void {
		if (upgrader.carry.energy > 0) {
			if (this.upgradeSite.input) {
				if (this.upgradeSite.input.hits < this.upgradeSite.input.hitsMax) {
					upgrader.task = Tasks.repair(this.upgradeSite.input);
					return;
				}
			} else {
				if (this.upgradeSite.inputConstructionSite) {
					upgrader.task = Tasks.build(this.upgradeSite.inputConstructionSite);
					return;
				}
			}
			if (!this.upgradeSite.controller.signedByMe) {							// <DO-NOT-MODIFY>: see license
				upgrader.task = Tasks.signController(this.upgradeSite.controller); 	// <DO-NOT-MODIFY>: see license
			} else {
				upgrader.task = Tasks.upgrade(this.upgradeSite.controller);
			}
		} else {
			// Recharge from best source
			if (this.upgradeSite.input && this.upgradeSite.input.energy > 0) {
				upgrader.task = Tasks.withdraw(this.upgradeSite.input);
			} else {
				let target = upgrader.pos.findClosestByRange(this.room.storageUnits);
				if (target) upgrader.task = Tasks.withdraw(target);
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
