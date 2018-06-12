// Mining site class for grouping relevant components

import {HiveCluster} from './_HiveCluster';
import {profile} from '../profiler/decorator';
import {ExtractorOverlord} from '../overlords/core/extractor';
import {Colony} from '../Colony';
import {log} from '../lib/logger/log';
import {Pathing} from '../pathing/pathing';
import {OverlordPriority} from '../priorities/priorities_overlords';

// interface MineralSiteMemory {
// 	stats: {
// 		usage: number;
// 		downtime: number;
// 	};
// }

@profile
export class ExtractionSite extends HiveCluster {
	extractor: StructureExtractor;
	mineral: Mineral;
	initialCapacity: number;
	output: StructureContainer | undefined;
	outputConstructionSite: ConstructionSite | undefined;
	private _outputPos: RoomPosition | undefined;
	overlord: ExtractorOverlord;

	constructor(colony: Colony, extractor: StructureExtractor) {
		super(colony, extractor, 'extractionSite');
		this.extractor = extractor;
		this.mineral = extractor.pos.lookFor(LOOK_MINERALS)[0];
		// Register output method
		let siteContainer = this.pos.findClosestByLimitedRange(this.room.containers, 2);
		if (siteContainer) {
			this.output = siteContainer;
		}
		if (this.outputPos) {
			this.colony.destinations.push(this.outputPos);
		}
		// Register output construction sites
		let nearbyOutputSites = this.pos.findInRange(this.room.constructionSites, 2, {
			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER
		}) as ConstructionSite[];
		this.outputConstructionSite = nearbyOutputSites[0];
		// Create a mining overlord for this
		this.overlord = new ExtractorOverlord(this, OverlordPriority.ownedRoom.mineral);
		if (Game.time % 100 == 0 && !this.output && !this.outputConstructionSite) {
			log.warning(`Mineral site at ${this.pos.print} has no output!`);
		}
	}

	// get memory(): MineralSiteMemory {
	// 	return Mem.wrap(this.colony.memory, this.name);
	// }

	/* Register appropriate resource withdrawal requests when the output gets sufficiently full */
	private registerOutputRequests(): void {
		// Register logisticsNetwork requests if approximate predicted amount exceeds transporter capacity
		if (this.output) {
			if (_.sum(this.output.store) > 0.5 * this.output.storeCapacity) {
				this.colony.logisticsNetwork.provideAll(this.output);
			} else if (_.sum(this.output.store) > 0 && this.overlord.drones.length == 0) {
				this.colony.logisticsNetwork.provideAll(this.output);
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
					log.error(`Extraction site at ${this.pos.print}: cannot build output! Result: ${result}`);
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
		// Visualizer.showInfo([`Usage:  ${this.memory.stats.usage.toPercent()}`,
		// 					 `Downtime: ${this.memory.stats.downtime.toPercent()}`], this);
	}
}
