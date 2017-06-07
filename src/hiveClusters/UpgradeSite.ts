// Upgrade site for grouping relevant components for an upgrader station

import {AbstractHiveCluster} from './AbstractHiveCluster';
import {TaskRepair} from '../tasks/task_repair';
import {TaskBuild} from '../tasks/task_build';

export class UpgradeSite extends AbstractHiveCluster implements IUpgradeSite {
	controller: StructureController;
	input: StructureLink | StructureContainer | null;
	inputConstructionSite: ConstructionSite | null;
	private _upgraders: ICreep[];

	constructor(colony: IColony, controller: StructureController) {
		super(colony, controller, 'upgradeSite');
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
	}

	get upgraders(): ICreep[] {
		if (!this._upgraders) {
			this._upgraders = this.colony.getCreepsByRole('upgrader');
		}
		return this._upgraders;
	}

	init(): void {
		if (this.input instanceof StructureLink) {
			if (this.input.energy < 400) {
				this.overlord.resourceRequests.registerResourceRequest(this.input);
			}
		} else if (this.input instanceof StructureContainer) {
			if (this.input.energy < 0.5 * this.input.storeCapacity) {
				this.overlord.resourceRequests.registerResourceRequest(this.input);
			}
		}
	}

	run(): void {
		// Build and maintain the input
		for (let upgrader of this.upgraders) {
			if (upgrader.carry.energy > 0) {
				if (this.input) {
					if (this.input.hits < this.input.hitsMax) {
						upgrader.task = new TaskRepair(this.input);
					}
				} else {
					if (this.inputConstructionSite) {
						upgrader.task = new TaskBuild(this.inputConstructionSite);
					}
				}
			}
		}
	}
}

