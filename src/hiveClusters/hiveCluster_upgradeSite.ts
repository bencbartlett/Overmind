// Upgrade site for grouping relevant components for an upgrader station

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {UpgradingOverlord} from '../overlords/core/overlord_upgrade';
import {Colony} from '../Colony';
import {Mem} from '../memory';
import {Visualizer} from '../visuals/Visualizer';

@profile
export class UpgradeSite extends HiveCluster {

	controller: StructureController;					// The controller for the site
	input: StructureLink | StructureContainer | undefined;	// The object receiving energy for the site
	inputConstructionSite: ConstructionSite | undefined;		// The construction site for the input, if there is one
	private settings: {
		storageBuffer: number,
		energyPerBodyUnit: number
	};
	overlord: UpgradingOverlord;
	energyPerTick: number;

	constructor(colony: Colony, controller: StructureController) {
		super(colony, controller, 'upgradeSite');
		this.controller = controller;
		// Register input
		let siteContainer = this.pos.findClosestByLimitedRange(this.room.containers, 4);
		let siteLink = this.pos.findClosestByLimitedRange(colony.links, 4);
		if (siteLink) {
			this.input = siteLink;
		} else if (siteContainer) {
			this.input = siteContainer;
		}// TODO: add container as battery
		// Register input construction sites
		let nearbyInputSites = this.pos.findInRange(this.room.structureSites, 4, {
			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER ||
											 s.structureType == STRUCTURE_LINK,
		});
		this.inputConstructionSite = nearbyInputSites[0];
		this.settings = {
			storageBuffer    : 100000,	// Number of upgrader parts scales with energy - this value
			energyPerBodyUnit: 25000,	// Scaling factor: this much excess energy adds one extra body repetition
		};
		// Register overlord
		this.overlord = new UpgradingOverlord(this);
		this.energyPerTick = _.sum(_.map(this.overlord.upgraders, upgrader => upgrader.getActiveBodyparts(WORK)));
	}

	get memory() {
		return Mem.wrap(this.colony.memory, 'upgradeSite');
	}

	get upgradePowerNeeded(): number {
		if (this.room.storage) { // Workers perform upgrading until storage is set up
			let amountOver = Math.max(this.room.storage.energy - this.settings.storageBuffer, 0);
			let upgradePower = 1 + Math.floor(amountOver / this.settings.energyPerBodyUnit);
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
				this.colony.linkNetwork.requestReceive(this.input);
			}
		} else if (this.input instanceof StructureContainer) {
			if (this.input.energy < 0.5 * this.input.storeCapacity) {
				this.colony.logisticsGroup.request(this.input, {dAmountdt: this.energyPerTick});
			}

		}
	}

	run(): void {

	}

	visuals() {
		let progress = `${Math.floor(this.controller.progress / 1000)}K`;
		let progressTotal = `${Math.floor(this.controller.progressTotal / 1000)}K`;
		let percent = `${Math.floor(100 * this.controller.progress / this.controller.progressTotal)}`;
		let info = [
			`Progress: ${progress}/${progressTotal} (${percent}%)`,
		];
		Visualizer.showInfo(info, this);
	}
}
