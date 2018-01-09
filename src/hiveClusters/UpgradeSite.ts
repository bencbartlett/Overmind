// Upgrade site for grouping relevant components for an upgrader station

import {AbstractHiveCluster} from './AbstractHiveCluster';
import {profile} from '../lib/Profiler';
import {UpgradingOverlord} from '../overlords/overlord_upgrade';

@profile
export class UpgradeSite extends AbstractHiveCluster implements IUpgradeSite {
	controller: StructureController;
	input: StructureLink | StructureContainer | null;
	inputConstructionSite: ConstructionSite | null;
	private settings: { [property: string]: number };
	overlord: IOverlord;

	// private _upgraders: Zerg[];

	constructor(colony: IColony, controller: StructureController) {
		super(colony, controller, 'upgradeSite');
		this.initMemory(colony.memory, 'upgradeSite');
		this.controller = controller;
		// Register input
		let siteContainer = this.pos.findClosestByLimitedRange(this.room.containers, 4);
		let siteLink = this.pos.findClosestByLimitedRange(colony.links, 4);
		if (siteLink) {
			this.input = siteLink;
		} else if (siteContainer) {
			this.input = siteContainer;
		}
		// Register input construction sites
		let nearbyInputSites = this.pos.findInRange(this.room.structureSites, 4, {
			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER ||
											 s.structureType == STRUCTURE_LINK,
		}) as ConstructionSite[];
		this.inputConstructionSite = nearbyInputSites[0];
		this.settings = {
			storageBuffer    : 100000,	// Number of upgrader parts scales with energy - this value
			energyPerBodyUnit: 20000,	// Scaling factor: this much excess energy adds one extra body repetition
		};
		// Register overlord
		this.overlord = new UpgradingOverlord(this);
	}

	// get upgraders(): Zerg[] {
	// 	if (!this._upgraders) {
	// 		this._upgraders = this.colony.getCreepsByRole('upgrader');
	// 	}
	// 	return this._upgraders;
	// }

	// /* Ensure there are upgraders and scale the size according to how much energy you have */
	// protected registerCreepRequests(): void {
	// 	if (this.room.storage) { // Workers perform upgrading until storage is set up
	// 		let amountOver = Math.max(this.room.storage.energy - this.overlord.settings.storageBuffer['upgrader'], 0);
	// 		let upgraderSize = 1 + Math.floor(amountOver / 20000);
	// 		if (this.controller.level == 8) {
	// 			upgraderSize = Math.min(upgraderSize, 3); // don't go above 15 work parts at RCL 8
	// 		}
	// 		let upgraderRole = new UpgraderSetup();
	// 		let numUpgradersNeeded = Math.ceil(upgraderSize * upgraderRole.bodyPatternCost /
	// 										   this.room.energyCapacityAvailable); // this causes a jump at 2 upgraders
	// 		if (this.upgraders.length < numUpgradersNeeded && this.colony.hatchery) {
	// 			this.colony.hatchery.enqueue(
	// 				upgraderRole.create(this.colony, {
	// 					assignment            : this.room.controller!,
	// 					patternRepetitionLimit: upgraderSize,
	// 				}));
	// 		}
	// 	}
	// }

	get upgradePowerNeeded(): number {
		if (this.room.storage) { // Workers perform upgrading until storage is set up
			let amountOver = Math.max(this.room.storage.energy - this.settings.storageBuffer, 0);
			let upgradePower = 1 + Math.floor(amountOver / 20000);
			if (this.controller.level == 8) {
				upgradePower = Math.min(upgradePower, 15); // don't go above 15 work parts at RCL 8
			}
			return upgradePower;
		} else {
			return 0;
		}
	}

	init(): void {
		if (this.input instanceof StructureLink) {
			if (this.input.energy < 400) {
				this.colony.linkRequests.requestReceive(this.input);
			}
		} else if (this.input instanceof StructureContainer) {
			if (this.input.energy < 0.5 * this.input.storeCapacity) {
				this.colony.transportRequests.requestEnergy(this.input);
			}
		}
		// this.registerCreepRequests();
	}

	run(): void {
		// // Build and maintain the input
		// for (let upgrader of this.upgraders) {
		// 	if (upgrader.carry.energy > 0) {
		// 		if (this.input) {
		// 			if (this.input.hits < this.input.hitsMax) {
		// 				upgrader.task = new TaskRepair(this.input);
		// 			}
		// 		} else {
		// 			if (this.inputConstructionSite) {
		// 				upgrader.task = new TaskBuild(this.inputConstructionSite);
		// 			}
		// 		}
		// 	}
		// }
	}
}
