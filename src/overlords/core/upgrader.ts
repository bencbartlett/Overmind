import {Overlord} from '../Overlord';
import {UpgradeSite} from '../../hiveClusters/upgradeSite';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';
import {boostResources} from '../../resources/map_resources';

export const UpgraderSetup = new CreepSetup('upgrader', {
	pattern  : [WORK, WORK, WORK, CARRY, MOVE],
	sizeLimit: Infinity,
});

export const UpgraderSetupRCL8 = new CreepSetup('upgrader', {
	pattern  : [WORK, WORK, WORK, CARRY, MOVE],
	sizeLimit: 5,
});

@profile
export class UpgradingOverlord extends Overlord {

	upgradersNeeded: number;
	upgraders: Zerg[];
	upgradeSite: UpgradeSite;
	settings: { [property: string]: number };
	room: Room;	//  Operates in owned room

	constructor(upgradeSite: UpgradeSite, priority = OverlordPriority.upgrading.upgrade) {
		super(upgradeSite, 'upgrade', priority);
		this.upgradeSite = upgradeSite;
		this.upgraders = this.zerg(UpgraderSetup.role);
		if ((this.colony.assets[boostResources.upgrade[3]] || 0) > 3000) {
			this.boosts[UpgraderSetup.role] = [boostResources.upgrade[3]];
		}
	}

	init() {
		if (this.colony.assets[RESOURCE_ENERGY] > UpgradeSite.settings.storageBuffer
			|| this.upgradeSite.controller.ticksToDowngrade < 5000) {
			if (this.colony.level == 8) {
				this.wishlist(1, UpgraderSetupRCL8);
			} else {
				const upgradePowerEach = UpgraderSetup.getBodyPotential(WORK, this.colony);
				const upgradersNeeded = Math.ceil(this.upgradeSite.upgradePowerNeeded / upgradePowerEach);
				this.wishlist(upgradersNeeded, UpgraderSetup);
			}
		}


		// upgradePower = _.sum(this.lifetimeFilter(this.upgraders), creep => creep.getActiveBodyparts(WORK));
		// if (upgradePower < this.upgradeSite.upgradePowerNeeded) {
		// 	let workPartsPerUpgraderUnit = 3; // TODO: Hard-coded
		// 	let upgraderSize = Math.ceil(this.upgradeSite.upgradePowerNeeded / workPartsPerUpgraderUnit);
		// 	this.requestCreep(new UpgraderSetup(upgraderSize));
		// }
		// this.creepReport(UpgraderSetup.role, upgradePower, this.upgradeSite.upgradePowerNeeded);

		this.requestBoosts(this.upgraders);
	}

	private handleUpgrader(upgrader: Zerg): void {
		if (upgrader.carry.energy > 0) {
			// Repair link
			if (this.upgradeSite.link && this.upgradeSite.link.hits < this.upgradeSite.link.hitsMax) {
				upgrader.task = Tasks.repair(this.upgradeSite.link);
				return;
			}
			// Repair container
			if (this.upgradeSite.battery && this.upgradeSite.battery.hits < this.upgradeSite.battery.hitsMax) {
				upgrader.task = Tasks.repair(this.upgradeSite.battery);
				return;
			}
			// Build construction site
			const inputSite = this.upgradeSite.findInputConstructionSite();
			if (inputSite) {
				upgrader.task = Tasks.build(inputSite);
				return;
			}
			// Sign controller if needed
			if (!this.upgradeSite.controller.signedByMe &&
				!this.upgradeSite.controller.signedByScreeps) {
				upgrader.task = Tasks.signController(this.upgradeSite.controller);
				return;
			}
			upgrader.task = Tasks.upgrade(this.upgradeSite.controller);
		} else {
			// Recharge from link or battery
			if (this.upgradeSite.link && this.upgradeSite.link.energy > 0) {
				upgrader.task = Tasks.withdraw(this.upgradeSite.link);
			} else if (this.upgradeSite.battery && this.upgradeSite.battery.energy > 0) {
				upgrader.task = Tasks.withdraw(this.upgradeSite.battery);
			}
			// Find somewhere else to recharge from
			else {
				if (this.upgradeSite.battery && this.upgradeSite.battery.targetedBy.length == 0) {
					upgrader.task = Tasks.recharge();
				}
			}
		}
	}

	run() {
		this.autoRun(this.upgraders, upgrader => this.handleUpgrader(upgrader));
	}
}
