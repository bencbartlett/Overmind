// Upgrade site for grouping relevant components for an upgrader station

import {HiveCluster} from './_HiveCluster';
import {profile} from '../profiler/decorator';
import {UpgradingOverlord} from '../overlords/core/upgrader';
import {Colony, ColonyStage} from '../Colony';
import {Mem} from '../Memory';
import {Visualizer} from '../visuals/Visualizer';
import {log} from '../console/log';
import {Stats} from '../stats/stats';
import {Pathing} from '../movement/Pathing';
import {MiningSite} from './miningSite';
import {WorkerSetup} from '../overlords/core/worker';
import {hasMinerals} from '../utilities/utils';

interface UpgradeSiteMemory {
	input?: { pos: protoPos, tick: number };
	stats: { downtime: number };
}

@profile
export class UpgradeSite extends HiveCluster {

	memory: UpgradeSiteMemory;
	controller: StructureController;						// The controller for the site
	upgradePowerNeeded: number;
	link: StructureLink | undefined;						// The primary object receiving energy for the site
	battery: StructureContainer | undefined; 				// The container to provide an energy buffer
	inputConstructionSite: ConstructionSite | undefined;	// The construction site for the input, if there is one
	private _batteryPos: RoomPosition | undefined;
	overlord: UpgradingOverlord;
	energyPerTick: number;

	static settings = {
		storageBuffer    : 100000,	// Number of upgrader parts scales with energy - this value
		energyPerBodyUnit: 25000,	// Scaling factor: this much excess energy adds one extra body repetition
		minLinkDistance  : 10,		// Required distance to build link
		linksRequestBelow: 200,		// Links request energy when less than this amount
	};

	constructor(colony: Colony, controller: StructureController) {
		super(colony, controller, 'upgradeSite');
		this.controller = controller;
		this.memory = Mem.wrap(this.colony.memory, 'upgradeSite');
		this.upgradePowerNeeded = this.getUpgradePowerNeeded();
		// Register bettery
		let allowableContainers = _.filter(this.room.containers, container =>
			container.pos.findInRange(FIND_SOURCES, 1).length == 0); // only count containers that aren't near sources
		this.battery = this.pos.findClosestByLimitedRange(allowableContainers, 3);
		// Register link
		// let allowableLinks = _.filter(this.colony.links, link => link.pos.findInRange(FIND_SOURCES, 2).length == 0);
		this.link = this.pos.findClosestByLimitedRange(colony.availableLinks, 4);
		this.colony.linkNetwork.claimLink(this.link);
		// Register input construction sites
		let nearbyInputSites = this.pos.findInRange(this.room.constructionSites, 4, {
			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER ||
											 s.structureType == STRUCTURE_LINK,
		});
		this.inputConstructionSite = nearbyInputSites[0];
		if (this.batteryPos) {
			this.colony.destinations.push(this.batteryPos);
		}
		// Register overlord
		this.overlord = new UpgradingOverlord(this);
		// Energy per tick is sum of upgrader body parts and nearby worker body parts
		this.energyPerTick = (_.sum(_.map(this.overlord.upgraders, upgrader => upgrader.getActiveBodyparts(WORK))) +
							  _.sum(_.map(_.filter(this.colony.getCreepsByRole(WorkerSetup.role), worker =>
											  worker.pos.inRangeTo((this.link || this.battery || this).pos, 2)),
										  worker => worker.getActiveBodyparts(WORK))));
		// Compute stats
		this.stats();
	}

	private getUpgradePowerNeeded(): number {
		if (this.room.storage) { // Workers perform upgrading until storage is set up
			let amountOver = Math.max(this.room.storage.energy - UpgradeSite.settings.storageBuffer, 0);
			let upgradePower = 1 + Math.floor(amountOver / UpgradeSite.settings.energyPerBodyUnit);
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
		if (this.link && this.link.energy < UpgradeSite.settings.linksRequestBelow) {
			this.colony.linkNetwork.requestReceive(this.link);
		}
		let inThreshold = this.colony.stage > ColonyStage.Larva ? 0.5 : 0.75;
		if (this.battery) {
			if (this.battery.energy < inThreshold * this.battery.storeCapacity) {
				this.colony.logisticsNetwork.requestInput(this.battery, {dAmountdt: this.energyPerTick});
			}
			if (hasMinerals(this.battery.store)) { // get rid of any minerals in the container if present
				this.colony.logisticsNetwork.requestOutputMinerals(this.battery);
			}
		}
	}

	/* Calculate where the input will be built for this site */
	private calculateBatteryPos(): RoomPosition | undefined {
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
		for (let pos of this.pos.getPositionsAtRange(2)) {
			if (pos.isWalkable(true)) {
				inputLocations.push(pos);
			}
		}
		// Try to find locations where there is maximal standing room
		let maxNeighbors = _.max(_.map(inputLocations, pos => pos.availableNeighbors(true).length));
		inputLocations = _.filter(inputLocations,
								  pos => pos.availableNeighbors(true).length >= maxNeighbors);
		// Return location closest to storage by path
		let inputPos = originPos.findClosestByPath(inputLocations);
		if (inputPos) {
			this.memory.input = {pos: inputPos, tick: Game.time};
			return inputPos;
		}
	}

	/* Calculate where the link will be built for this site */
	private calculateLinkPos(): RoomPosition | undefined {
		let originPos: RoomPosition | undefined = undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.colony.roomPlanner.storagePos) {
			originPos = this.colony.roomPlanner.storagePos;
		}
		if (originPos && this.batteryPos) {
			// Build link at last location on path from origin to battery
			let path = Pathing.findShortestPath(this.batteryPos, originPos).path;
			return path[0];
		}
	}

	get batteryPos(): RoomPosition | undefined {
		if (this.battery) {
			return this.battery.pos;
		} else if (this.inputConstructionSite) {
			return this.inputConstructionSite.pos;
		} else {
			// Recalculate the input position or pull from memory if recent enough
			if (!this._batteryPos) {
				if (this.memory.input && Game.time - this.memory.input.tick < 100) {
					this._batteryPos = derefRoomPosition(this.memory.input.pos);
				} else {
					this._batteryPos = this.calculateBatteryPos();
					if (!this._batteryPos && Game.time % 25 == 0) {
						log.alert(`Upgrade site at ${this.pos.print}: no room plan set; ` +
								  `cannot determine battery position!`);
					}
				}
			}
			return this._batteryPos;
		}
	}

	/* Build a container output at the optimal location */
	private buildBatteryIfMissing(): void {
		if (!this.battery && !this.inputConstructionSite) {
			let buildHere = this.batteryPos;
			if (buildHere) {
				let result = buildHere.createConstructionSite(STRUCTURE_CONTAINER);
				if (result == OK) {
					return;
				} else {
					log.warning(`Upgrade site at ${this.pos.print}: cannot build battery! Result: ${result}`);
				}
			}
		}
	}

	/* Build an input link at the optimal location */
	private buildLinkIfMissing(): void {
		if (!this.colony.storage ||
			Pathing.distance(this.pos, this.colony.storage.pos) < UpgradeSite.settings.minLinkDistance) {
			return;
		}
		let numLinks = this.colony.links.length +
					   _.filter(this.colony.constructionSites,
								site => site.structureType == STRUCTURE_LINK).length;
		let numLinksAllowed = CONTROLLER_STRUCTURES.link[this.colony.level];
		// Proceed if you don't have a link or one being built and there are extra links that can be built
		if (!this.link && !this.inputConstructionSite && numLinksAllowed > numLinks) {
			let clustersHaveLinks: boolean = (!!this.colony.hatchery && !!this.colony.hatchery.link &&
											  !!this.colony.commandCenter && !!this.colony.commandCenter.link);
			let miningSitesInRoom = _.map(this.room.sources, s => this.colony.miningSites[s.id]) as MiningSite[];
			let farSites = _.filter(miningSitesInRoom, site =>
				Pathing.distance(this.colony.storage!.pos, site.pos) > MiningSite.settings.minLinkDistance);
			let sitesHaveLinks = _.every(farSites, site => site.output instanceof StructureLink);
			// Proceed if all mining sites have links if needed and all clusters have links
			if (clustersHaveLinks && sitesHaveLinks) {
				let buildHere = this.calculateLinkPos();
				if (buildHere) {
					let result = buildHere.createConstructionSite(STRUCTURE_LINK);
					if (result != OK) {
						log.warning(`Upgrade site at ${this.pos.print}: cannot build link! Result: ${result}`);
					}
				}
			}
		}
	}

	private stats() {
		let defaults = {
			downtime: 0,
		};
		if (!this.memory.stats) this.memory.stats = defaults;
		_.defaults(this.memory.stats, defaults);
		// Compute downtime
		this.memory.stats.downtime = (this.memory.stats.downtime * (CREEP_LIFE_TIME - 1) +
									  (this.battery ? +this.battery.isEmpty : 0)) / CREEP_LIFE_TIME;
		Stats.log(`colonies.${this.colony.name}.upgradeSite.downtime`, this.memory.stats.downtime);
	}

	run(): void {
		if (Game.time % 25 == 7) {
			this.buildBatteryIfMissing();
		} else if (Game.time % 25 == 8) {
			this.buildLinkIfMissing();
		}
	}

	visuals() {
		let info = [];
		if (this.controller.level != 8) {
			let progress = `${Math.floor(this.controller.progress / 1000)}K`;
			let progressTotal = `${Math.floor(this.controller.progressTotal / 1000)}K`;
			let percent = `${Math.floor(100 * this.controller.progress / this.controller.progressTotal)}`;
			info.push(`Progress: ${progress}/${progressTotal} (${percent}%)`);

		}
		info.push(`Downtime: ${this.memory.stats.downtime.toPercent()}`);
		Visualizer.showInfo(info, this);
	}
}
