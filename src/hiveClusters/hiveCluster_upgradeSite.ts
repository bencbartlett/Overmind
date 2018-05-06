// Upgrade site for grouping relevant components for an upgrader station

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {UpgradingOverlord} from '../overlords/core/overlord_upgrade';
import {Colony} from '../Colony';
import {Mem} from '../memory';
import {Visualizer} from '../visuals/Visualizer';
import {log} from '../lib/logger/log';
import {WorkerSetup} from '../creepSetup/defaultSetups';

interface UpgradeSiteMemory {
	input?: { pos: protoPos, tick: number };
}

@profile
export class UpgradeSite extends HiveCluster {

	controller: StructureController;					// The controller for the site
	input: StructureLink | StructureContainer | undefined;	// The object receiving energy for the site
	inputConstructionSite: ConstructionSite | undefined;		// The construction site for the input, if there is one
	private _inputPos: RoomPosition | undefined;
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
		let allowableContainers = _.filter(this.room.containers, container =>
			container.pos.findInRange(FIND_SOURCES, 1).length == 0); // only count containers that aren't near sources
		let siteContainer = this.pos.findClosestByLimitedRange(allowableContainers, 3);
		let siteLink = this.pos.findClosestByLimitedRange(colony.links, 3);
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
		// Energy per tick is sum of upgrader body parts and nearby worker body parts
		this.energyPerTick = (_.sum(_.map(this.overlord.upgraders, upgrader => upgrader.getActiveBodyparts(WORK))) +
							  _.sum(_.map(_.filter(this.colony.getCreepsByRole(WorkerSetup.role),
												   worker => worker.pos.inRangeTo((this.input || this).pos, 2)),
										  worker => worker.getActiveBodyparts(WORK)))) * UPGRADE_CONTROLLER_POWER;
	}

	get memory(): UpgradeSiteMemory {
		return Mem.wrap(this.colony.memory, 'upgradeSite');
	}

	get upgradePowerNeeded(): number {
		if (this.room.storage) { // Workers perform upgrading until storage is set up
			let amountOver = Math.max(this.room.storage.energy - this.settings.storageBuffer, 0);
			let upgradePower = 1 + Math.floor(amountOver / this.settings.energyPerBodyUnit);
			if (amountOver > 500000) {
				upgradePower *= 2; // double upgrade power if we have lots of surplus energy
			}
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

	/* Calculate where the input will be built for this site */
	private calculateInputPos(): RoomPosition | undefined {
		let originPos: RoomPosition | undefined = undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.colony.roomPlanner.storagePos) {
			originPos = this.colony.roomPlanner.storagePos;
		} else {
			return;
		}
		// Find all positions at range 2 from controller
		let inputLocations: RoomPosition[] = [];
		for (let dx of [-2, -1, 0, 1, 2]) {
			for (let dy of [-2, -1, 0, 1, 2]) {
				if ((dx == -2 || dx == 2) || (dy == -2 || dy == 2)) {
					let pos = new RoomPosition(this.pos.x + dx, this.pos.y + dy, this.pos.roomName);
					if (!pos.isEdge && pos.isPassible(true)) {
						inputLocations.push(pos);
					}
				}
			}
		}
		// Return location closest to storage by path
		let inputPos = originPos.findClosestByPath(inputLocations);
		if (inputPos) {
			this.memory.input = {pos: inputPos, tick: Game.time};
			return inputPos;
		}
	}

	get inputPos(): RoomPosition | undefined {
		if (this.input) {
			return this.input.pos;
		} else if (this.inputConstructionSite) {
			return this.inputConstructionSite.pos;
		} else {
			// Recalculate the input position or pull from memory if recent enough
			if (!this._inputPos) {
				if (this.memory.input && Game.time - this.memory.input.tick < 100) {
					this._inputPos = derefRoomPosition(this.memory.input.pos);
				} else {
					this._inputPos = this.calculateInputPos();
					if (!this._inputPos) {
						log.warning(`Upgrade site at ${this.pos.print}: cannot determine inputPos!`);
					}
				}
			}
			return this._inputPos;
		}
	}

	/* Build a container output at the optimal location */
	private buildContainerIfMissing(): void {
		if (!this.input && !this.inputConstructionSite) {
			let buildHere = this.inputPos;
			if (buildHere) {
				let result = buildHere.createConstructionSite(STRUCTURE_CONTAINER);
				if (result == OK) {
					return;
				} else {
					log.warning(`Upgrade site at ${this.pos.print}: cannot build input! Result: ${result}`);
				}
			}
		}
	}

	run(): void {
		if (Game.time % 25 == 7) {
			this.buildContainerIfMissing();
		}
	}

	visuals() {
		if (this.controller.level != 8) {
			let progress = `${Math.floor(this.controller.progress / 1000)}K`;
			let progressTotal = `${Math.floor(this.controller.progressTotal / 1000)}K`;
			let percent = `${Math.floor(100 * this.controller.progress / this.controller.progressTotal)}`;
			let info = [
				`Progress: ${progress}/${progressTotal} (${percent}%)`,
			];
			Visualizer.showInfo(info, this);
		}
	}
}
