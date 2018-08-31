// // Mining site class for grouping relevant components
//
// import {HiveCluster} from './_HiveCluster';
// import {profile} from '../profiler/decorator';
// import {ExtractorOverlord} from '../overlords/mining/extractor';
// import {Colony} from '../Colony';
// import {log} from '../console/log';
// import {Pathing} from '../movement/Pathing';
// import {OverlordPriority} from '../priorities/priorities_overlords';
// import {$} from '../caching/GlobalCache';
//
// // interface MineralSiteMemory {
// // 	stats: {
// // 		usage: number;
// // 		downtime: number;
// // 	};
// // }
//
// @profile
// export class ExtractionSite extends HiveCluster {
// 	extractor: StructureExtractor;
// 	mineral: Mineral;
// 	initialCapacity: number;
// 	output: StructureContainer | undefined;
// 	outputPos: RoomPosition | undefined;
// 	overlord: ExtractorOverlord;
//
// 	constructor(colony: Colony, extractor: StructureExtractor) {
// 		super(colony, extractor, 'extractionSite', true);
// 		this.extractor = extractor;
// 		this.mineral = extractor.pos.lookFor(LOOK_MINERALS)[0];
// 		// Register output method
// 		$.set(this, 'output', () => {
// 			const siteContainer = this.pos.findClosestByLimitedRange(this.room.containers, 2);
// 			if (siteContainer) {
// 				return siteContainer;
// 			}
// 		}, 10);
// 		this.outputPos = $.pos(this, 'outputPos', () => {
// 			if (this.output) {
// 				return this.output.pos;
// 			}
// 			let outputSite = this.findOutputConstructionSite();
// 			if (outputSite) {
// 				return outputSite.pos;
// 			}
// 			let containerPos = this.calculateContainerPos();
// 			if (containerPos) {
// 				return containerPos;
// 			}
// 			log.alert(`Mining site at ${this.pos.print}: no room plan set; cannot determine outputPos!`);
// 		}, 10);
// 		if (this.outputPos) this.colony.destinations.push(this.outputPos);
// 		if (Game.time % 100 == 0 && !this.output) {
// 			log.warning(`Mineral site at ${this.pos.print} has no output!`);
// 		}
// 	}
//
// 	refresh() {
// 		$.refreshRoom(this);
// 		// if (!this.room) {
// 		// 	_.remove(this.colony.hiveClusters, hc => hc.ref == this.ref);
// 		// 	delete this.colony.extractionSites[this.extractor.id];
// 		// 	return;
// 		// }
// 		$.refresh(this, 'extractor', 'mineral', 'output');
// 	}
//
// 	spawnMoarOverlords() {
// 		let priority = this.room.my ? OverlordPriority.ownedRoom.mineral : OverlordPriority.remoteSKRoom.mineral;
// 		this.overlord = new ExtractorOverlord(this, priority);
// 	}
//
// 	findOutputConstructionSite(): ConstructionSite | undefined {
// 		let nearbyOutputSites = this.pos.findInRange(this.room.constructionSites, 2, {
// 			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER
// 		}) as ConstructionSite[];
// 		return _.first(nearbyOutputSites);
// 	}
//
// 	/* Register appropriate resource withdrawal requests when the output gets sufficiently full */
// 	private registerOutputRequests(): void {
// 		// Register logisticsNetwork requests if approximate predicted amount exceeds transporter capacity
// 		if (this.output) {
// 			if (_.sum(this.output.store) > 0.5 * this.output.storeCapacity) {
// 				this.colony.logisticsNetwork.requestOutput(this.output, {resourceType: 'all'});
// 			} else if (_.sum(this.output.store) > 0 && this.overlord.drones.length == 0) {
// 				this.colony.logisticsNetwork.requestOutput(this.output, {resourceType: 'all'});
// 			}
// 		}
// 	}
//
// 	/* Initialization tasks: register resource transfer reqeusts, register creep requests */
// 	init(): void {
// 		this.registerOutputRequests();
// 	}
//
// 	/* Calculate where the container output will be built for this site */
// 	private calculateContainerPos(): RoomPosition | undefined {
// 		let originPos: RoomPosition | undefined = undefined;
// 		if (this.colony.storage) {
// 			originPos = this.colony.storage.pos;
// 		} else if (this.colony.roomPlanner.storagePos) {
// 			originPos = this.colony.roomPlanner.storagePos;
// 		}
// 		if (originPos) {
// 			let path = Pathing.findShortestPath(this.pos, originPos).path;
// 			return path[0];
// 		}
// 	}
//
// 	/* Build a container output at the optimal location */
// 	private buildOutputIfNeeded(): void {
// 		if (!this.output && !this.findOutputConstructionSite()) {
// 			let buildHere = this.outputPos;
// 			if (buildHere) {
// 				// Build a link if one is available
// 				let structureType: StructureConstant = STRUCTURE_CONTAINER;
// 				let result = buildHere.createConstructionSite(structureType);
// 				if (result != OK) {
// 					log.error(`Extraction site at ${this.pos.print}: cannot build output! Result: ${result}`);
// 				}
// 			}
// 		}
// 	}
//
// 	/* Run tasks: make output construciton site if needed; build and maintain the output structure */
// 	run(): void {
// 		let rebuildOnTick = 5;
// 		let rebuildFrequency = 10;
// 		if (Game.time % rebuildFrequency == rebuildOnTick) {
// 			this.buildOutputIfNeeded();
// 		}
// 	}
//
// 	visuals() {
// 		// Visualizer.showInfo([`Usage:  ${this.memory.stats.usage.toPercent()}`,
// 		// 					 `Downtime: ${this.memory.stats.downtime.toPercent()}`], this);
// 	}
// }
