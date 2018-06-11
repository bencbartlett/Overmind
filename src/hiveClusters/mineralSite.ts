// Mining site class for grouping relevant components

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {MineralOverlord} from '../overlords/core/extractor';
import {Colony, ColonyStage} from '../Colony';
import {Mem} from '../memory';
import {log} from '../lib/logger/log';
import {Visualizer} from '../visuals/Visualizer';
import {LogisticsNetwork} from '../logistics/LogisticsNetwork';
import {Pathing} from '../pathing/pathing';
import {OverlordPriority} from '../priorities/priorities_overlords';

interface MineralSiteMemory {
	stats: {
		usage: number;
		downtime: number;
	};
}

@profile
export class MineralSite extends HiveCluster {
	mineral: Mineral;
	extractor: StructureExtractor | undefined;
	//mineralPerTick: number;
	initialCapacity: number;
	output: StructureContainer | undefined;
	outputConstructionSite: ConstructionSite | undefined;
	private _outputPos: RoomPosition | undefined;
	overlord: MineralOverlord;

	constructor(colony: Colony, mineral: Mineral) {
		super(colony, mineral, 'mineralSite');
		this.mineral = mineral;
		// Register output method
		let siteContainer = this.pos.findClosestByLimitedRange(this.room.containers, 2);
		if (siteContainer) {
			this.output = siteContainer;
		}
		// Register output construction sites
		let nearbyOutputSites = this.pos.findInRange(this.room.constructionSites, 2, {
			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER
		}) as ConstructionSite[];
		this.outputConstructionSite = nearbyOutputSites[0];
		// Create a mining overlord for this
		let priority = OverlordPriority.ownedRoom.mineral;
		this.overlord = new MineralOverlord(this, priority);
		if (Game.time % 100 == 0 && !this.output && !this.outputConstructionSite) {
			log.warning(`Mineral site at ${this.pos.print} has no output!`);
		}
	}

	get memory(): MineralSiteMemory {
		return Mem.wrap(this.colony.memory, this.name);
	}

	get mineralPerTick(): number {
		let filteredDrones = _.filter(this.overlord.drones, drone => drone.pos.inRangeTo(this.pos, 3));
		let miningPowerAssigned = _.sum(_.map(filteredDrones, drone => drone.getActiveBodyparts(WORK)));
		return miningPowerAssigned * HARVEST_MINERAL_POWER;
	}

	/* Return the approximate predicted energy if a transporter needed to come from storage.
	 * If no storage, uses hatchery pos; if no hatchery, returns current energy */
	get approximatePredictedResources(): number {
		if (!this.output) {
			return 0;
		}
		let targetingTransporters = LogisticsNetwork.targetingTransporters(this.output);
		let dropoffPoint = this.colony.storage ? this.colony.storage.pos :
						   this.colony.hatchery ? this.colony.hatchery.pos : undefined;
		let distance = dropoffPoint ? Pathing.distance(this.output.pos, dropoffPoint) : 0;
		let predictedSurplus = this.mineralPerTick * distance;
		let outflux = _.sum(_.map(targetingTransporters, tporter => tporter.carryCapacity - _.sum(tporter.carry)));
		return Math.min(_.sum(this.output.store) + predictedSurplus - outflux, 0);
	}

	/* Register appropriate resource withdrawal requests when the output gets sufficiently full */
	private registerOutputRequests(): void {
		// Register logisticsNetwork requests if approximate predicted amount exceeds transporter capacity
		if (this.output) {
			let transportCapacity = 200 * this.colony.level;
			let threshold = this.colony.stage > ColonyStage.Larva ? 0.8 : 0.5;
			if (_.sum(this.output.store) > threshold * transportCapacity) {
				this.colony.logisticsNetwork.provideAll(this.output, {dAmountdt: this.mineralPerTick});
				//console.log(this.mineralPerTick);
			}
		}
	}

	/* Initialization tasks: register resource transfer reqeusts, register creep requests */
	init(): void {
		this.registerOutputRequests();
	}

	get outputPos(): RoomPosition | undefined {
		if (this.output) {
			return this.output.pos;
		} else if (this.outputConstructionSite) {
			return this.outputConstructionSite.pos;
		} else {
			if (!this._outputPos) {
				this._outputPos = this.calculateContainerPos();
				if (!this._outputPos && Game.time % 25 == 0) {
					log.alert(`Mining site at ${this.pos.print}: no room plan set; cannot determine outputPos!`);
				}
			}
			return this._outputPos;
		}
	}

	/* Calculate where the container output will be built for this site */
	private calculateContainerPos(): RoomPosition | undefined {
		let originPos: RoomPosition | undefined = undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.colony.roomPlanner.storagePos) {
			originPos = this.colony.roomPlanner.storagePos;
		}
		if (originPos) {
			let path = Pathing.findShortestPath(this.pos, originPos).path;
			return path[0];
		}
	}

	/* Build a container output at the optimal location */
	private buildOutputIfNeeded(): void {
		if (!this.output && !this.outputConstructionSite) {
			let buildHere = this.outputPos;
			if (buildHere) {
				// Build a link if one is available
				let structureType: StructureConstant = STRUCTURE_CONTAINER;
				let result = buildHere.createConstructionSite(structureType);
				if (result != OK) {
					log.error(`Mineral site at ${this.pos.print}: cannot build output! Result: ${result}`);
				}
			}
		}
	}

	/* Run tasks: make output construciton site if needed; build and maintain the output structure */
	run(): void {
		let rebuildOnTick = 5;
		let rebuildFrequency = 10;
		if (Game.time % rebuildFrequency == rebuildOnTick) {
			this.buildOutputIfNeeded();
		}
	}

	visuals() {
		Visualizer.showInfo([`Usage:  ${this.memory.stats.usage.toPercent()}`,
							 `Downtime: ${this.memory.stats.downtime.toPercent()}`], this);
	}
}
