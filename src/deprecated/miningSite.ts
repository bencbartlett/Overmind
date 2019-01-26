// // Mining site class for grouping relevant components
//
// import {HiveCluster} from './_HiveCluster';
// import {profile} from '../profiler/decorator';
// import {MiningOverlord} from '../overlords/mining/miner';
// import {Colony, ColonyStage} from '../Colony';
// import {Mem} from '../Memory';
// import {log} from '../console/log';
// import {OverlordPriority} from '../priorities/priorities_overlords';
// import {LogisticsNetwork} from '../logistics/LogisticsNetwork';
// import {Pathing} from '../movement/Pathing';
// import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../utilities/Cartographer';
// import {$} from '../caching/GlobalCache';
// import {exponentialMovingAverage} from '../utilities/utils';
//
// interface MiningSiteMemory {
// 	stats: {
// 		usage: number;
// 		downtime: number;
// 	};
// }
//
// @profile
// export class MiningSite extends HiveCluster {
// 	// room: Room | undefined;
// 	source: Source;
// 	memory: MiningSiteMemory;
// 	energyPerTick: number;
// 	miningPowerNeeded: number;
// 	output: StructureContainer | StructureLink | undefined;
// 	outputPos: RoomPosition | undefined;
// 	shouldDropMine: boolean;
// 	overlord: MiningOverlord;
//
// 	static settings = {
// 		minLinkDistance : 10,
// 		dropMineUntilRCL: 3,
// 	};
//
// 	constructor(colony: Colony, source: Source) {
// 		super(colony, source, 'miningSite', true);
// 		this.source = source;
// 		this.memory = Mem.wrap(this.colony.memory, this.ref);
// 		this.energyPerTick = source.energyCapacity / ENERGY_REGEN_TIME;
// 		this.miningPowerNeeded = Math.ceil(this.energyPerTick / HARVEST_POWER) + 1;
// 		// Register output method
// 		$.set(this, 'output', () => {
// 			const siteLink = this.pos.findClosestByLimitedRange(this.colony.availableLinks, 2);
// 			if (siteLink) {
// 				this.colony.linkNetwork.claimLink(siteLink);
// 				return siteLink;
// 			}
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
// 		this.shouldDropMine = this.colony.level < MiningSite.settings.dropMineUntilRCL;
// 		if (!this.shouldDropMine && Game.time % 100 == 0 && !this.output) {
// 			log.warning(`Mining site at ${this.pos.print} has no output!`);
// 		}
// 		// Calculate statistics
// 		this.stats();
// 	}
//
// 	refresh() {
// 		this.memory = Mem.wrap(this.colony.memory, this.ref);
// 		$.refreshRoom(this);
// 		// if (!this.room) {
// 		// 	delete this.colony.miningSites[this.source.id];
// 		// 	_.remove(this.colony.hiveClusters, hc => hc.ref == this.ref);
// 		// 	return;
// 		// }
// 		$.refresh(this, 'source', 'output');
// 		if (!this.shouldDropMine && Game.time % 100 == 0 && !this.output) {
// 			log.warning(`Mining site at ${this.pos.print} has no output!`);
// 		}
// 		this.stats();
// 	}
//
// 	spawnMoarOverlords() {
// 		// Create a mining overlord for this
// 		let priority = OverlordPriority.ownedRoom.mine;
// 		if (!this.room.my) {
// 			priority = Cartographer.roomType(this.room.name) == ROOMTYPE_SOURCEKEEPER ?
// 					   OverlordPriority.remoteSKRoom.mine : OverlordPriority.remoteRoom.mine;
// 		}
// 		this.overlord = new MiningOverlord(this, priority, this.shouldDropMine);
// 	}
//
// 	private stats() {
// 		let defaults = {
// 			usage   : 0,
// 			downtime: 0,
// 		};
// 		if (!this.memory.stats) this.memory.stats = defaults;
// 		_.defaults(this.memory.stats, defaults);
// 		// Compute uptime
// 		if (this.source.ticksToRegeneration == 1) {
// 			this.memory.stats.usage = (this.source.energyCapacity - this.source.energy) / this.source.energyCapacity;
// 		}
// 		this.memory.stats.downtime = exponentialMovingAverage(this.output ? +this.output.isFull : 0,
// 													this.memory.stats.downtime, CREEP_LIFE_TIME);
// 	}
//
// 	/* Return the approximate predicted energy if a transporter needed to come from storage.
// 	 * If no storage, uses hatchery pos; if no hatchery, returns current energy */
// 	get approximatePredictedEnergy(): number {
// 		if (!(this.output && this.output instanceof StructureContainer)) {
// 			return 0;
// 		}
// 		let targetingTransporters = LogisticsNetwork.targetingTransporters(this.output);
// 		let dropoffPoint = this.colony.storage ? this.colony.storage.pos :
// 						   this.colony.hatchery ? this.colony.hatchery.pos : undefined;
// 		let distance = dropoffPoint ? Pathing.distance(this.output.pos, dropoffPoint) : 0;
// 		let predictedSurplus = this.energyPerTick * distance;
// 		let outflux = _.sum(_.map(targetingTransporters, tporter => tporter.carryCapacity - _.sum(tporter.carry)));
// 		return Math.min(_.sum(this.output.store) + predictedSurplus - outflux, 0);
// 	}
//
// 	findOutputConstructionSite(): ConstructionSite | undefined {
// 		const nearbyOutputSites = this.pos.findInRange(this.room.constructionSites, 2, {
// 			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER ||
// 											 s.structureType == STRUCTURE_LINK,
// 		}) as ConstructionSite[];
// 		return _.first(nearbyOutputSites);
// 	}
//
// 	/* Register appropriate resource withdrawal requests when the output gets sufficiently full */
// 	private registerOutputRequests(): void {
// 		if (!this.output) return;
// 		// Register logisticsNetwork requests if approximate predicted amount exceeds transporter capacity
// 		if (this.output instanceof StructureContainer) {
// 			let transportCapacity = 200 * this.colony.level;
// 			let threshold = this.colony.stage > ColonyStage.Larva ? 0.8 : 0.5;
// 			if (_.sum(this.output.store) > threshold * transportCapacity) {
// 				this.colony.logisticsNetwork.requestOutput(this.output, {
// 					resourceType: 'all',
// 					dAmountdt   : this.energyPerTick
// 				});
// 			}
// 		} else {
// 			// If the link will be full with next deposit from the miner
// 			let minerCapacity = 150;
// 			if (this.output.energy + minerCapacity > this.output.energyCapacity) {
// 				this.colony.linkNetwork.requestTransmit(this.output);
// 			}
// 		}
// 	}
//
// 	/* Initialization tasks: register resource transfer reqeusts, register creep requests */
// 	init(): void {
// 		this.registerOutputRequests();
// 	}
//
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
// 			return _.find(path, pos => this.source.pos.getRangeTo(pos) == 1);
// 		}
// 	}
//
// 	/* Calculate where the link will be built */
// 	private calculateLinkPos(): RoomPosition | undefined {
// 		let originPos: RoomPosition | undefined = undefined;
// 		if (this.colony.storage) {
// 			originPos = this.colony.storage.pos;
// 		} else if (this.colony.roomPlanner.storagePos) {
// 			originPos = this.colony.roomPlanner.storagePos;
// 		}
// 		if (originPos) {
// 			let path = Pathing.findShortestPath(this.pos, originPos).path;
// 			return _.find(path, pos => this.source.pos.getRangeTo(pos) == 2);
// 		}
// 	}
//
// 	/* Build a container output at the optimal location */
// 	private buildOutputIfNeeded(): void {
// 		if (this.shouldDropMine) {
// 			return; // only build containers in reserved, owned, or SK rooms
// 		}
// 		if (!this.output && !this.findOutputConstructionSite()) {
// 			let buildHere = this.outputPos;
// 			if (buildHere) {
// 				// Build a link if one is available
// 				let structureType: StructureConstant = STRUCTURE_CONTAINER;
// 				if (this.room == this.colony.room) {
// 					let numLinks = this.colony.links.length +
// 								   _.filter(this.colony.constructionSites,
// 											site => site.structureType == STRUCTURE_LINK).length;
// 					let numLinksAllowed = CONTROLLER_STRUCTURES.link[this.colony.level];
// 					if (numLinksAllowed > numLinks &&
// 						(this.colony.bunker || (this.colony.hatchery && this.colony.hatchery.link)) &&
// 						this.colony.commandCenter && this.colony.commandCenter.link &&
// 						Pathing.distance(this.pos,
// 										 this.colony.commandCenter.pos) > MiningSite.settings.minLinkDistance) {
// 						structureType = STRUCTURE_LINK;
// 						buildHere = this.calculateLinkPos()!; // link pos definitely defined if buildHere is defined
// 					}
// 				}
// 				let result = buildHere.createConstructionSite(structureType);
// 				if (result != OK) {
// 					log.error(`Mining site in ${this.room.print}: cannot build output of type ${structureType} ` +
// 							  `at ${buildHere.print}! Result: ${result}`);
// 				}
// 			}
// 		}
// 	}
//
// 	private destroyContainerIfNeeded(): void {
// 		let storage = this.colony.storage;
// 		// Possibly replace if you are in colony room, have a container output and are sufficiently far from storage
// 		if (this.room == this.colony.room && this.output && this.output instanceof StructureContainer &&
// 			storage && Pathing.distance(this.pos, storage.pos) > MiningSite.settings.minLinkDistance) {
// 			let numLinks = this.colony.links.length +
// 						   _.filter(this.colony.constructionSites, s => s.structureType == STRUCTURE_LINK).length;
// 			let numLinksAllowed = CONTROLLER_STRUCTURES.link[this.colony.level];
// 			let miningSitesInRoom = _.map(this.room.sources, s => this.colony.miningSites[s.id]) as MiningSite[];
// 			let fartherSites = _.filter(miningSitesInRoom, site =>
// 				Pathing.distance(storage!.pos, site.pos) > Pathing.distance(storage!.pos, this.pos));
// 			let everyFartherSiteHasLink = _.every(fartherSites, site => site.output instanceof StructureLink);
// 			// Destroy the output if 1) more links can be built, 2) every farther site has a link and
// 			// 3) hatchery and commandCenter both have links
// 			if (numLinksAllowed > numLinks && everyFartherSiteHasLink &&
// 				(this.colony.bunker || (this.colony.hatchery && this.colony.hatchery.link)) &&
// 				this.colony.commandCenter && this.colony.commandCenter.link) {
// 				this.output.destroy();
// 			}
// 		}
// 		// Destroy container if you already have a link output and it's not being used by anything else
// 		if (this.output && this.output instanceof StructureLink) {
// 			let containerOutput = this.source.pos.findClosestByLimitedRange(this.room.containers, 1);
// 			if (containerOutput && this.colony.hatchery && containerOutput.pos.getRangeTo(this.colony.hatchery) > 2 &&
// 				containerOutput.pos.getRangeTo(this.colony.upgradeSite) > 3) {
// 				containerOutput.destroy();
// 			}
// 		}
// 	};
//
// 	/* Run tasks: make output construciton site if needed; build and maintain the output structure */
// 	run(): void {
// 		const rebuildOnTick = 5;
// 		const rebuildFrequency = 10;
// 		if (Game.time % rebuildFrequency == rebuildOnTick - 1) {
// 			this.destroyContainerIfNeeded();
// 		}
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
