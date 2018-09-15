// Colony class - organizes all assets of an owned room into a colony

import {profile} from './profiler/decorator';
import {Hatchery} from './hiveClusters/hatchery';
import {CommandCenter} from './hiveClusters/commandCenter';
import {UpgradeSite} from './hiveClusters/upgradeSite';
import {WorkerOverlord} from './overlords/core/worker';
import {Zerg} from './zerg/Zerg';
import {RoomPlanner} from './roomPlanner/RoomPlanner';
import {HiveCluster} from './hiveClusters/_HiveCluster';
import {LinkNetwork} from './logistics/LinkNetwork';
import {LOG_STATS_INTERVAL, Stats} from './stats/stats';
import {SporeCrawler} from './hiveClusters/sporeCrawler';
import {RoadLogistics} from './logistics/RoadLogistics';
import {LogisticsNetwork} from './logistics/LogisticsNetwork';
import {TransportOverlord} from './overlords/core/transporter';
import {Energetics} from './logistics/Energetics';
import {StoreStructure} from './declarations/typeGuards';
import {maxBy, mergeSum, minBy} from './utilities/utils';
import {Abathur} from './resources/Abathur';
import {EvolutionChamber} from './hiveClusters/evolutionChamber';
import {TransportRequestGroup} from './logistics/TransportRequestGroup';
import {SpawnGroup} from './logistics/SpawnGroup';
import {bunkerLayout, getPosFromBunkerCoord} from './roomPlanner/layouts/bunker';
import {Mem} from './memory/Memory';
import {RandomWalkerScoutOverlord} from './overlords/scouting/randomWalker';
import {EXPANSION_EVALUATION_FREQ, ExpansionPlanner} from './strategy/ExpansionPlanner';
import {log} from './console/log';
import {assimilationLocked} from './assimilation/decorator';
import {DefaultOverlord} from './overlords/core/default';
import {$} from './caching/GlobalCache';
import {DirectiveHarvest} from './directives/resource/harvest';
import {DirectiveExtract} from './directives/resource/extract';
import {Cartographer, ROOMTYPE_CONTROLLER} from './utilities/Cartographer';

export enum ColonyStage {
	Larva = 0,		// No storage and no incubator
	Pupa  = 1,		// Has storage but RCL < 8
	Adult = 2,		// RCL 8 room
}

export enum DEFCON {
	safe               = 0,
	invasionNPC        = 1,
	boostedInvasionNPC = 2,
	playerInvasion     = 2,
	bigPlayerInvasion  = 3,
}

export function getAllColonies(): Colony[] {
	return _.values(Overmind.colonies);
}

export interface BunkerData {
	anchor: RoomPosition;
	topSpawn: StructureSpawn | undefined;
	coreSpawn: StructureSpawn | undefined;
	rightSpawn: StructureSpawn | undefined;
}

export interface ColonyMemory {
	defcon: {
		level: number,
		tick: number,
	},
	expansionData: {
		possibleExpansions: { [roomName: string]: number | boolean },
		expiration: number,
	},
}

const defaultColonyMemory: ColonyMemory = {
	defcon       : {
		level: DEFCON.safe,
		tick : -Infinity
	},
	expansionData: {
		possibleExpansions: {},
		expiration        : 0,
	},
};

@profile
@assimilationLocked
export class Colony {
	// Colony memory
	memory: ColonyMemory;								// Memory.colonies[name]
	// Room associations
	name: string;										// Name of the primary colony room
	ref: string;
	id: number; 										// Order in which colony is instantiated from Overmind
	roomNames: string[];								// The names of all rooms including the primary room
	room: Room;											// Primary (owned) room of the colony
	outposts: Room[];									// Rooms for remote resource collection
	rooms: Room[];										// All rooms including the primary room
	pos: RoomPosition;
	assets: { [resourceType: string]: number };
	// Physical colony structures and roomObjects
	controller: StructureController;					// These are all duplicated from room properties
	spawns: StructureSpawn[];							// |
	extensions: StructureExtension[];					// |
	storage: StructureStorage | undefined;				// |
	links: StructureLink[];								// |
	availableLinks: StructureLink[];
	// claimedLinks: StructureLink[];						// | Links belonging to hive cluseters excluding mining groups
	// dropoffLinks: StructureLink[]; 						// | Links not belonging to a hiveCluster, used as dropoff
	terminal: StructureTerminal | undefined;			// |
	towers: StructureTower[];							// |
	labs: StructureLab[];								// |
	powerSpawn: StructurePowerSpawn | undefined;		// |
	nuker: StructureNuker | undefined;					// |
	observer: StructureObserver | undefined;			// |
	tombstones: Tombstone[]; 							// | Tombstones in all colony rooms
	drops: { [resourceType: string]: Resource[] }; 		// | Dropped resources in all colony rooms
	sources: Source[];									// | Sources in all colony rooms
	extractors: StructureExtractor[];					// | All extractors in owned and remote rooms
	flags: Flag[];										// | Flags assigned to the colony
	constructionSites: ConstructionSite[];				// | Construction sites in all colony rooms
	repairables: Structure[];							// | Repairable structures, discounting barriers and roads
	rechargeables: rechargeObjectType[];				// | Things that can be recharged from
	// obstacles: RoomPosition[]; 							// | List of other obstacles, e.g. immobile creeps
	destinations: RoomPosition[];
	// Hive clusters
	hiveClusters: HiveCluster[];						// List of all hive clusters
	commandCenter: CommandCenter | undefined;			// Component with logic for non-spawning structures
	hatchery: Hatchery | undefined;						// Component to encapsulate spawner logic
	spawnGroup: SpawnGroup | undefined;
	evolutionChamber: EvolutionChamber | undefined; 	// Component for mineral processing
	upgradeSite: UpgradeSite;							// Component to provide upgraders with uninterrupted energy
	sporeCrawler: SporeCrawler;
	// miningSites: { [sourceID: string]: MiningSite };	// Component with logic for mining and hauling
	// extractionSites: { [extractorID: string]: ExtractionSite };
	miningSites: { [flagName: string]: DirectiveHarvest };	// Component with logic for mining and hauling
	extractionSites: { [flagName: string]: DirectiveExtract };
	// Operational mode
	bootstrapping: boolean; 							// Whether colony is bootstrapping or recovering from crash
	isIncubating: boolean;								// If the colony is incubating
	level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; 				// Level of the colony's main room
	stage: number;										// The stage of the colony "lifecycle"
	defcon: number;
	terminalState: TerminalState | undefined;
	breached: boolean;
	lowPowerMode: boolean; 								// Activate if RCL8 and full energy
	layout: 'twoPart' | 'bunker';						// Which room design colony uses
	bunker: BunkerData | undefined;						// The center tile of the bunker, else undefined
	// Creeps and subsets
	creeps: Creep[];										// Creeps bound to the colony
	creepsByRole: { [roleName: string]: Creep[] };		// Creeps hashed by their role name
	// Resource requests
	linkNetwork: LinkNetwork;
	logisticsNetwork: LogisticsNetwork;
	transportRequests: TransportRequestGroup;
	// Overlords
	overlords: {
		default: DefaultOverlord;
		work: WorkerOverlord;
		logistics: TransportOverlord;
		scout?: RandomWalkerScoutOverlord;
	};
	// Road network
	roadLogistics: RoadLogistics;
	// Room planner
	roomPlanner: RoomPlanner;
	abathur: Abathur;

	static settings = {
		remoteSourcesByLevel: {
			1: 1,
			2: 2,
			3: 3,
			4: 4,
			5: 5,
			6: 6,
			7: 7,
			8: 9,
		},
		maxSourceDistance   : 100
	};

	constructor(id: number, roomName: string, outposts: string[]) {
		// Primitive colony setup
		this.id = id;
		this.name = roomName;
		this.ref = roomName;
		this.memory = Mem.wrap(Memory.colonies, roomName, defaultColonyMemory, true);
		// Register colony globally to allow 'W1N1' and 'w1n1' to refer to Overmind.colonies.W1N1
		global[this.name] = this;
		global[this.name.toLowerCase()] = this;
		// Build the colony
		this.build(roomName, outposts);
	}

	build(roomName: string, outposts: string[]): void {
		// Register rooms
		this.roomNames = [roomName].concat(outposts);
		this.room = Game.rooms[roomName];
		this.outposts = _.compact(_.map(outposts, outpost => Game.rooms[outpost]));
		this.rooms = [this.room].concat(this.outposts);
		this.miningSites = {}; 				// filled in by harvest directives
		this.extractionSites = {};			// filled in by extract directives
		// Register creeps
		this.creeps = Overmind.cache.creepsByColony[this.name] || [];
		this.creepsByRole = _.groupBy(this.creeps, creep => creep.memory.role);
		// Register the rest of the colony components; the order in which these are called is important!
		this.registerRoomObjects_cached();	// Register real colony components
		this.registerOperationalState();	// Set the colony operational state
		this.registerUtilities(); 			// Register logistics utilities, room planners, and layout info
		this.registerHiveClusters(); 		// Build the hive clusters
		/* Colony.spawnMoarOverlords() gets called from Overmind.ts, along with Directive.spawnMoarOverlords() */
	}

	refresh(): void {
		this.memory = Mem.wrap(Memory.colonies, this.room.name, defaultColonyMemory, true);
		// Refresh rooms
		this.room = Game.rooms[this.room.name];
		this.outposts = _.compact(_.map(this.outposts, outpost => Game.rooms[outpost.name]));
		this.rooms = [this.room].concat(this.outposts);
		// refresh creeps
		this.creeps = Overmind.cache.creepsByColony[this.name] || [];
		this.creepsByRole = _.groupBy(this.creeps, creep => creep.memory.role);
		// Register the rest of the colony components; the order in which these are called is important!
		this.refreshRoomObjects();
		this.registerOperationalState();
		this.refreshUtilities();
		this.refreshHiveClusters();
	}

	private registerRoomObjects(): void {
		// Create placeholder arrays for remaining properties to be filled in by the Overmind
		this.flags = []; // filled in by directives
		this.destinations = []; // filled in by various hive clusters and directives
		// Register room objects across colony rooms
		this.controller = this.room.controller!; // must be controller since colonies are based in owned rooms
		this.spawns = _.sortBy(_.filter(this.room.spawns, spawn => spawn.my && spawn.isActive()), spawn => spawn.ref);
		this.extensions = this.room.extensions;
		this.storage = this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined;
		this.links = this.room.links;
		this.availableLinks = _.clone(this.room.links);
		this.terminal = this.room.terminal && this.room.terminal.isActive() ? this.room.terminal : undefined;
		this.towers = this.room.towers;
		this.labs = _.sortBy(_.filter(this.room.labs, lab => lab.my && lab.isActive()),
							 lab => 50 * lab.pos.y + lab.pos.x); // Labs are sorted in reading order of positions
		this.powerSpawn = this.room.powerSpawn;
		this.nuker = this.room.nuker;
		this.observer = this.room.observer;
		this.pos = (this.storage || this.terminal || this.spawns[0] || this.controller).pos;
		// Register physical objects across all rooms in the colony
		this.sources = _.sortBy(_.flatten(_.map(this.rooms, room => room.sources)),
								source => source.pos.getMultiRoomRangeTo(this.pos));
		this.extractors = _(this.rooms)
			.map(room => room.extractor)
			.compact()
			.filter(extractor => (extractor!.my && extractor!.room.my)
								 || Cartographer.roomType(extractor!.room.name) != ROOMTYPE_CONTROLLER)
			.sortBy(extractor => extractor!.pos.getMultiRoomRangeTo(this.pos)).value() as StructureExtractor[];
		this.constructionSites = _.flatten(_.map(this.rooms, room => room.constructionSites));
		this.tombstones = _.flatten(_.map(this.rooms, room => room.tombstones));
		this.drops = _.merge(_.map(this.rooms, room => room.drops));
		this.repairables = _.flatten(_.map(this.rooms, room => room.repairables));
		this.rechargeables = _.flatten(_.map(this.rooms, room => room.rechargeables));
		// Register assets
		this.assets = this.getAllAssets();
	}

	private registerRoomObjects_cached(): void {
		// Create placeholder arrays for remaining properties to be filled in by the Overmind
		this.flags = []; // filled in by directives
		this.destinations = []; // filled in by various hive clusters and directives
		// Register room objects across colony rooms
		this.controller = this.room.controller!; // must be controller since colonies are based in owned rooms
		this.extensions = this.room.extensions;
		this.links = this.room.links;
		this.availableLinks = _.clone(this.room.links);
		this.towers = this.room.towers;
		this.powerSpawn = this.room.powerSpawn;
		this.nuker = this.room.nuker;
		this.observer = this.room.observer;
		$.set(this, 'spawns', () => _.sortBy(_.filter(this.room.spawns,
													  spawn => spawn.my && spawn.isActive()), spawn => spawn.ref));
		$.set(this, 'storage', () => this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined);
		// this.availableLinks = _.clone(this.room.links);
		$.set(this, 'terminal', () => this.room.terminal && this.room.terminal.isActive() ? this.room.terminal : undefined);
		$.set(this, 'labs', () => _.sortBy(_.filter(this.room.labs, lab => lab.my && lab.isActive()),
										   lab => 50 * lab.pos.y + lab.pos.x));
		this.pos = (this.storage || this.terminal || this.spawns[0] || this.controller).pos;
		// Register physical objects across all rooms in the colony
		$.set(this, 'sources', () => _.sortBy(_.flatten(_.map(this.rooms, room => room.sources)),
											  source => source.pos.getMultiRoomRangeTo(this.pos)));
		for (let source of this.sources) {
			DirectiveHarvest.createIfNotPresent(source.pos, 'pos');
		}
		$.set(this, 'extractors', () =>
			_(this.rooms)
				.map(room => room.extractor)
				.compact()
				.filter(e => (e!.my && e!.room.my)
							 || Cartographer.roomType(e!.room.name) != ROOMTYPE_CONTROLLER)
				.sortBy(e => e!.pos.getMultiRoomRangeTo(this.pos)).value() as StructureExtractor[]);
		for (let extractor of this.extractors) {
			DirectiveExtract.createIfNotPresent(extractor.pos, 'pos');
		}
		$.set(this, 'repairables', () => _.flatten(_.map(this.rooms, room => room.repairables)));
		$.set(this, 'rechargeables', () => _.flatten(_.map(this.rooms, room => room.rechargeables)));
		$.set(this, 'constructionSites', () => _.flatten(_.map(this.rooms, room => room.constructionSites)), 10);
		$.set(this, 'tombstones', () => _.flatten(_.map(this.rooms, room => room.tombstones)), 5);
		this.drops = _.merge(_.map(this.rooms, room => room.drops));
		// Register assets
		this.assets = this.getAllAssets();
	}

	private refreshRoomObjects(): void {
		$.refresh(this, 'controller', 'extensions', 'links', 'towers', 'powerSpawn', 'nuker', 'observer', 'spawns',
				  'storage', 'terminal', 'labs', 'sources', 'extractors', 'constructionSites', 'repairables',
				  'rechargeables');
		$.set(this, 'constructionSites', () => _.flatten(_.map(this.rooms, room => room.constructionSites)), 10);
		$.set(this, 'tombstones', () => _.flatten(_.map(this.rooms, room => room.tombstones)), 5);
		this.drops = _.merge(_.map(this.rooms, room => room.drops));
		// Re-compute assets
		this.assets = this.getAllAssets();
	}

	private registerOperationalState(): void {
		this.level = this.controller.level as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
		this.bootstrapping = false;
		this.isIncubating = false;
		if (this.storage && this.spawns[0]) {
			// If the colony has storage and a hatchery
			if (this.controller.level == 8) {
				this.stage = ColonyStage.Adult;
			} else {
				this.stage = ColonyStage.Pupa;
			}
		} else {
			this.stage = ColonyStage.Larva;
		}
		// this.incubatingColonies = [];
		this.lowPowerMode = Energetics.lowPowerMode(this);
		// Set DEFCON level
		// TODO: finish this
		let defcon = DEFCON.safe;
		let defconDecayTime = 200;
		if (this.room.dangerousHostiles.length > 0 && !this.controller.safeMode) {
			let effectiveHostileCount = _.sum(_.map(this.room.dangerousHostiles,
													hostile => hostile.boosts.length > 0 ? 2 : 1));
			if (effectiveHostileCount >= 3) {
				defcon = DEFCON.boostedInvasionNPC;
			} else {
				defcon = DEFCON.invasionNPC;
			}
		}
		if (this.memory.defcon) {
			if (defcon < this.memory.defcon.level) { // decay defcon level over time if defcon less than memory value
				if (this.memory.defcon.tick + defconDecayTime < Game.time) {
					this.memory.defcon.level = defcon;
					this.memory.defcon.tick = Game.time;
				}
			} else if (defcon > this.memory.defcon.level) { // refresh defcon time if it increases by a level
				this.memory.defcon.level = defcon;
				this.memory.defcon.tick = Game.time;
			}
		} else {
			this.memory.defcon = {
				level: defcon,
				tick : Game.time
			};
		}
		this.defcon = this.memory.defcon.level;
		this.breached = (this.room.dangerousHostiles.length > 0 &&
						 this.creeps.length == 0 &&
						 !this.controller.safeMode);
		this.terminalState = undefined;
	}

	private registerUtilities(): void {
		// Resource requests
		this.linkNetwork = new LinkNetwork(this);
		this.logisticsNetwork = new LogisticsNetwork(this);
		this.transportRequests = new TransportRequestGroup();
		// Register a room planner
		this.roomPlanner = new RoomPlanner(this);
		if (this.roomPlanner.memory.bunkerData && this.roomPlanner.memory.bunkerData.anchor) {
			this.layout = 'bunker';
			let anchor = derefRoomPosition(this.roomPlanner.memory.bunkerData.anchor);
			// log.debug(JSON.stringify(`anchor for ${this.name}: ${anchor}`));
			let spawnPositions = _.map(bunkerLayout[8]!.buildings.spawn.pos, c => getPosFromBunkerCoord(c, this));
			// log.debug(JSON.stringify(`spawnPositions for ${this.name}: ${spawnPositions}`));
			let rightSpawnPos = maxBy(spawnPositions, pos => pos.x) as RoomPosition;
			let topSpawnPos = minBy(spawnPositions, pos => pos.y) as RoomPosition;
			let coreSpawnPos = anchor.findClosestByRange(spawnPositions) as RoomPosition;
			// log.debug(JSON.stringify(`spawnPoses: ${rightSpawnPos}, ${topSpawnPos}, ${coreSpawnPos}`));
			this.bunker = {
				anchor    : anchor,
				topSpawn  : topSpawnPos.lookForStructure(STRUCTURE_SPAWN) as StructureSpawn | undefined,
				coreSpawn : coreSpawnPos.lookForStructure(STRUCTURE_SPAWN) as StructureSpawn | undefined,
				rightSpawn: rightSpawnPos.lookForStructure(STRUCTURE_SPAWN) as StructureSpawn | undefined,
			};
		} else {
			this.layout = 'twoPart';
		}
		// Register road network
		this.roadLogistics = new RoadLogistics(this);
		// "Organism Abathur with you."
		this.abathur = new Abathur(this);
	}

	private refreshUtilities(): void {
		this.linkNetwork.refresh();
		this.logisticsNetwork.refresh();
		this.transportRequests.refresh();
		this.roomPlanner.refresh();
		if (this.bunker) {
			if (this.bunker.topSpawn) {
				this.bunker.topSpawn = Game.getObjectById(this.bunker.topSpawn.id) as StructureSpawn | undefined;
			}
			if (this.bunker.coreSpawn) {
				this.bunker.coreSpawn = Game.getObjectById(this.bunker.coreSpawn.id) as StructureSpawn | undefined;
			}
			if (this.bunker.rightSpawn) {
				this.bunker.rightSpawn = Game.getObjectById(this.bunker.rightSpawn.id) as StructureSpawn | undefined;
			}
		}
		this.roadLogistics.refresh();
		this.abathur.refresh();
	}

	/* Instantiate and associate virtual colony components to group similar structures together */
	private registerHiveClusters(): void {
		this.hiveClusters = [];
		// Instantiate the command center if there is storage in the room - this must be done first!
		if (this.stage > ColonyStage.Larva) {
			this.commandCenter = new CommandCenter(this, this.storage!);
		}
		// Instantiate the hatchery - the incubation directive assignes hatchery to incubator's hatchery if none exists
		if (this.spawns[0]) {
			this.hatchery = new Hatchery(this, this.spawns[0]);
		}
		// Instantiate evolution chamber once there are three labs all in range 2 of each other
		if (this.terminal && _.filter(this.labs, lab =>
			_.all(this.labs, otherLab => lab.pos.inRangeTo(otherLab, 2))).length >= 3) {
			this.evolutionChamber = new EvolutionChamber(this, this.terminal);
		}
		// Instantiate the upgradeSite
		this.upgradeSite = new UpgradeSite(this, this.controller);
		// Instantiate spore crawlers to wrap towers
		if (this.towers[0]) {
			this.sporeCrawler = new SporeCrawler(this, this.towers[0]);
		}
		// Reverse the hive clusters for correct order for init() and run()
		this.hiveClusters.reverse();
	}

	private refreshHiveClusters(): void {
		for (let i = this.hiveClusters.length - 1; i >= 0; i--) {
			this.hiveClusters[i].refresh();
		}
	}

	/* Instantiate all overlords for the colony */
	spawnMoarOverlords(): void {
		this.overlords = {
			default  : new DefaultOverlord(this),
			work     : new WorkerOverlord(this),
			logistics: new TransportOverlord(this),
		};
		if (!this.observer) {
			this.overlords.scout = new RandomWalkerScoutOverlord(this);
		}
		for (let hiveCluster of this.hiveClusters) {
			hiveCluster.spawnMoarOverlords();
		}
	}

	getCreepsByRole(roleName: string): Creep[] {
		return this.creepsByRole[roleName] || [];
	}

	getZergByRole(roleName: string): (Zerg | undefined)[] {
		return _.map(this.getCreepsByRole(roleName), creep => Overmind.zerg[creep.name]);
	}

	/* Summarizes the total of all resources in colony store structures, labs, and some creeps */
	private getAllAssets(verbose = false): { [resourceType: string]: number } {
		// if (this.name == 'E8S45') verbose = true; // 18863
		// Include storage structures and manager carry
		let stores = _.map(<StoreStructure[]>_.compact([this.storage, this.terminal]), s => s.store);
		let creepCarriesToInclude = _.map(this.creeps, creep => creep.carry) as { [resourceType: string]: number }[];
		let allAssets: { [resourceType: string]: number } = mergeSum([...stores, ...creepCarriesToInclude]);
		// Include lab amounts
		for (let lab of this.labs) {
			if (lab.mineralType) {
				if (!allAssets[lab.mineralType]) {
					allAssets[lab.mineralType] = 0;
				}
				allAssets[lab.mineralType] += lab.mineralAmount;
			}
		}
		if (verbose) log.debug(`${this.room.print} assets: ` + JSON.stringify(allAssets));
		return allAssets;
	}

	init(): void {
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.init());	// Initialize each hive cluster
		this.roadLogistics.init();											// Initialize the road network
		this.linkNetwork.init();											// Initialize link network
		this.roomPlanner.init();											// Initialize the room planner
		if (Game.time % EXPANSION_EVALUATION_FREQ == 5 * this.id) {			// Re-evaluate expansion data if needed
			ExpansionPlanner.refreshExpansionData(this);
		}
	}

	run(): void {
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.run());		// Run each hive cluster
		this.linkNetwork.run();												// Run the link network
		this.roadLogistics.run();											// Run the road network
		this.roomPlanner.run();												// Run the room planner
		this.stats();														// Log stats per tick
	}

	stats(): void {
		if (Game.time % LOG_STATS_INTERVAL == 0) {
			// Log energy and rcl
			Stats.log(`colonies.${this.name}.storage.energy`, this.storage ? this.storage.energy : undefined);
			Stats.log(`colonies.${this.name}.rcl.level`, this.controller.level);
			Stats.log(`colonies.${this.name}.rcl.progress`, this.controller.progress);
			Stats.log(`colonies.${this.name}.rcl.progressTotal`, this.controller.progressTotal);
			// Log average miningSite usage and uptime and estimated colony energy income
			let numSites = _.keys(this.miningSites).length;
			let avgDowntime = _.sum(this.miningSites, site => site.memory.stats.downtime) / numSites;
			let avgUsage = _.sum(this.miningSites, site => site.memory.stats.usage) / numSites;
			let energyInPerTick = _.sum(this.miningSites,
										site => site.overlords.mine.energyPerTick * site.memory.stats.usage);
			Stats.log(`colonies.${this.name}.miningSites.avgDowntime`, avgDowntime);
			Stats.log(`colonies.${this.name}.miningSites.avgUsage`, avgUsage);
			Stats.log(`colonies.${this.name}.miningSites.energyInPerTick`, energyInPerTick);
			Stats.log(`colonies.${this.name}.assets`, this.assets);
			// Log defensive properties
			Stats.log(`colonies.${this.name}.defcon`, this.defcon);
			let avgBarrierHits = _.sum(this.room.barriers, barrier => barrier.hits) / this.room.barriers.length;
			Stats.log(`colonies.${this.name}.avgBarrierHits`, avgBarrierHits);
		}
	}

	visuals(): void {
		// let report: string[] = [];
		// report.push(`Hatchery:`)
		// for (let spawn of this.spawns) {
		// 	if (spawn.spawning) {
		// 		report.push(`${bullet}Spawning`)
		// 	}
		// }
		// _.forEach(this.hiveClusters, hiveCluster => hiveCluster.visuals()); // Display hiveCluster visuals
	}
}
