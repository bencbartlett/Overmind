// Upgrade site for grouping relevant components for an upgrader station

import {AbstractHiveCluster} from './AbstractHiveCluster';
import {profile} from '../lib/Profiler';
import {UpgradingOverlord} from '../overlords/overlord_upgrade';
import {Colony} from '../Colony';

@profile
export class UpgradeSite extends AbstractHiveCluster implements IUpgradeSite {

	controller: StructureController;					// The controller for the site
	input: StructureLink | StructureContainer | null;	// The object receiving energy for the site
	inputConstructionSite: ConstructionSite | null;		// The construction site for the input, if there is one
	private settings: { [property: string]: number };
	overlord: UpgradingOverlord;

	constructor(colony: Colony, controller: StructureController) {
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
		});
		this.inputConstructionSite = nearbyInputSites[0];
		this.settings = {
			storageBuffer    : 100000,	// Number of upgrader parts scales with energy - this value
			energyPerBodyUnit: 20000,	// Scaling factor: this much excess energy adds one extra body repetition
		};
		// Register overlord
		this.overlord = new UpgradingOverlord(this);
	}

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
		// Register energy requests
		if (this.input instanceof StructureLink) {
			if (this.input.energy < 400) {
				this.colony.linkRequests.requestReceive(this.input);
			}
		} else if (this.input instanceof StructureContainer) {
			if (this.input.energy < 0.5 * this.input.storeCapacity) {
				this.colony.transportRequests.requestEnergy(this.input);
			}
		}
	}

	run(): void {

	}
}
