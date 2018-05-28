// Colony class - organizes all assets of an owned room into a colony

import {profile} from './profiler/decorator';
import {MiningSite} from './hiveClusters/miningSite';
import {Hatchery} from './hiveClusters/hatchery';
import {CommandCenter} from './hiveClusters/commandCenter';
import {UpgradeSite} from './hiveClusters/upgradeSite';
import {Overseer} from './Overseer';
import {WorkerOverlord} from './overlords/core/worker';
import {Zerg} from './Zerg';
import {RoomPlanner} from './roomPlanner/RoomPlanner';
import {HiveCluster} from './hiveClusters/HiveCluster';
import {LinkNetwork} from './logistics/LinkNetwork';
import {Stats} from './stats/stats';
import {SporeCrawler} from './hiveClusters/sporeCrawler';
import {RoadLogistics} from './logistics/RoadLogistics';
import {LogisticsNetwork} from './logistics/LogisticsNetwork';
import {TransportOverlord} from './overlords/core/transporter';
import {Energetics} from './logistics/Energetics';
import {StoreStructure} from './declarations/typeGuards';

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

@profile
export class Colony {
	// Colony memory
	memory: ColonyMemory;								// Memory.colonies[name]
	// Colony overseer
	overseer: Overseer;									// This runs the directives and overlords
	// Room associations
	name: string;										// Name of the primary colony room
	id: number; 										// Order in which colony is instantiated from Overmind
	colony: Colony;										// Reference to itself for simple overlord instantiation
	roomNames: string[];								// The names of all rooms including the primary room
	room: Room;											// Primary (owned) room of the colony
	outposts: Room[];									// Rooms for remote resource collection
	rooms: Room[];										// All rooms including the primary room
	pos: RoomPosition;
	// Physical colony structures and roomObjects
	controller: StructureController;					// These are all duplicated from room properties
	spawns: StructureSpawn[];							// |
	extensions: StructureExtension[];					// |
	storage: StructureStorage | undefined;				// |
	links: StructureLink[];								// |
	claimedLinks: StructureLink[];						// | Links belonging to hive cluseters excluding mining groups
	dropoffLinks: StructureLink[]; 						// | Links not belonging to a hiveCluster, used as dropoff
	terminal: StructureTerminal | undefined;			// |
	towers: StructureTower[];							// |
	labs: StructureLab[];								// |
	powerSpawn: StructurePowerSpawn | undefined;		// |
	nuker: StructureNuker | undefined;					// |
	observer: StructureObserver | undefined;			// |
	tombstones: Tombstone[]; 							// | Tombstones in all colony rooms
	sources: Source[];									// | Sources in all colony rooms
	flags: Flag[];										// | Flags across the colony
	constructionSites: ConstructionSite[];				// | Construction sites in all colony rooms
	repairables: Structure[];							// | Repairable structures, discounting barriers and roads
	obstacles: RoomPosition[]; 							// | List of other obstacles, e.g. immobile creeps
	// Hive clusters
	hiveClusters: HiveCluster[];						// List of all hive clusters
	commandCenter: CommandCenter | undefined;			// Component with logic for non-spawning structures
	hatchery: Hatchery | undefined;						// Component to encapsulate spawner logic
	upgradeSite: UpgradeSite;							// Component to provide upgraders with uninterrupted energy
	sporeCrawlers: SporeCrawler[];
	miningSites: { [sourceID: string]: MiningSite };	// Component with logic for mining and hauling
	// Operational mode
	incubator: Colony | undefined; 						// The colony responsible for incubating this one, if any
	isIncubating: boolean;								// If the colony is incubating
	incubatingColonies: Colony[];						// List of colonies that this colony is incubating
	level: number; 										// Level of the colony's main room
	stage: number;										// The stage of the colony "lifecycle"
	defcon: number;
	lowPowerMode: boolean; 								// Activate if RCL8 and full energy
	// Creeps and subsets
	creeps: Zerg[];										// Creeps bound to the colony
	creepsByRole: { [roleName: string]: Zerg[] };		// Creeps hashed by their role name
	// Resource requests
	linkNetwork: LinkNetwork;
	logisticsNetwork: LogisticsNetwork;
	// Overlords
	overlords: {
		// supply: SupplierOverlord;
		work: WorkerOverlord;
		logistics: TransportOverlord;
	};
	// Road network
	roadLogistics: RoadLogistics;
	// Room planner
	roomPlanner: RoomPlanner;

	constructor(id: number, roomName: string, outposts: string[], creeps: Zerg[]) {
		// Primitive colony setup
		this.id = id;
		this.name = roomName;
		this.colony = this;
		if (!Memory.colonies[this.name]) {
			Memory.colonies[this.name] = {
				defcon       : {level: DEFCON.safe, tick: Game.time},
				overseer     : <OverseerMemory>{},
				hatchery     : <HatcheryMemory>{},
				commandCenter: <CommandCenterMemory>{},
			};
		}
		this.memory = Memory.colonies[this.name];
		// Register creeps
		this.registerCreeps(creeps);
		// Instantiate the colony overseer
		this.overseer = new Overseer(this);
		// Register colony capitol and outposts
		this.roomNames = [roomName].concat(outposts);
		this.room = Game.rooms[roomName];
		this.outposts = _.compact(_.map(outposts, outpost => Game.rooms[outpost]));
		this.rooms = [Game.rooms[roomName]].concat(this.outposts);
		// Register real colony components
		this.registerRoomObjects();
		// Set the colony operational state
		this.registerOperationalState();
		// Create placeholder arrays for remaining properties to be filled in by the Overmind
		this.flags = [];
		this.registerUtilities();
		// Build the hive clusters
		this.registerHiveClusters();
		// Register colony overlords
		this.spawnMoarOverlords();
	}

	private registerCreeps(creeps: Zerg[]): void {
		this.creeps = creeps;
		this.creepsByRole = _.groupBy(creeps, creep => creep.memory.role);
	}

	private registerRoomObjects(): void {
		this.controller = this.room.controller!; // must be controller since colonies are based in owned rooms
		this.pos = this.controller.pos; // This is used for overlord initialization but isn't actually useful
		this.spawns = _.sortBy(_.filter(this.room.spawns, spawn => spawn.my), spawn => spawn.ref);
		this.extensions = this.room.extensions;
		this.storage = this.room.storage;
		this.links = this.room.links;
		this.terminal = this.room.terminal;
		this.towers = this.room.towers;
		this.labs = this.room.labs;
		this.powerSpawn = this.room.getStructures(STRUCTURE_POWER_SPAWN)[0] as StructurePowerSpawn;
		this.nuker = this.room.getStructures(STRUCTURE_NUKER)[0] as StructureNuker;
		this.observer = this.room.getStructures(STRUCTURE_OBSERVER)[0] as StructureObserver;
		// Register physical objects across all rooms in the colony
		this.sources = _.sortBy(_.flatten(_.map(this.rooms, room => room.sources)),
								source => source.pos.getMultiRoomRangeTo(this.pos)); // sort for roadnetwork determinism
		this.constructionSites = _.flatten(_.map(this.rooms, room => room.constructionSites));
		this.tombstones = _.flatten(_.map(this.rooms, room => room.tombstones));
		this.repairables = _.flatten(_.map(this.rooms, room => room.repairables));
		this.obstacles = [];
	}

	private registerOperationalState(): void {
		this.level = this.controller.level;
		this.isIncubating = false;
		if (this.storage && this.storage.isActive() &&
			this.spawns[0] && this.spawns[0].pos.findClosestByLimitedRange(this.room.containers, 2)) {
			// If the colony has storage and a hatchery and a hatchery battery
			if (this.controller.level == 8) {
				this.stage = ColonyStage.Adult;
			} else {
				this.stage = ColonyStage.Pupa;
			}
		} else {
			this.stage = ColonyStage.Larva;
		}
		this.incubatingColonies = [];
		this.lowPowerMode = Energetics.lowPowerMode(this);
		// Set DEFCON level
		// TODO: finish this
		let defcon = DEFCON.safe;
		let defconDecayTime = 200;
		if (this.room.dangerousHostiles.length > 0) {
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
	}

	private registerUtilities(): void {
		// Resource requests
		this.linkNetwork = new LinkNetwork(this);
		this.logisticsNetwork = new LogisticsNetwork(this);
		// Register a room planner
		this.roomPlanner = new RoomPlanner(this);
		// Register road network
		this.roadLogistics = new RoadLogistics(this);
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
		// Instantiate the upgradeSite
		if (this.controller) {
			this.upgradeSite = new UpgradeSite(this, this.controller);
		}
		// Instantiate spore crawlers to wrap towers
		this.sporeCrawlers = _.map(this.towers, tower => new SporeCrawler(this, tower));
		// Sort claimed and unclaimed links
		let claimedPositions = _.map(_.compact([this.commandCenter, this.hatchery, this.upgradeSite]),
									 hiveCluster => hiveCluster!.pos);
		this.claimedLinks = _.filter(this.links, function (link) {
			let nearbyClaimingThings = link.pos.findInRange(claimedPositions, 3);
			if (nearbyClaimingThings) {
				return nearbyClaimingThings.length > 0;
			}
			let nearbySources = link.pos.findInRange(FIND_SOURCES, 2);
			if (nearbySources) {
				return nearbySources.length > 0;
			}
			return false;
		}) as StructureLink[];
		this.dropoffLinks = _.filter(this.links, link => this.claimedLinks.includes(link) == false);
		// Mining sites is an object of ID's and MiningSites
		let sourceIDs = _.map(this.sources, source => source.ref);
		let miningSites = _.map(this.sources, source => new MiningSite(this, source));
		this.miningSites = _.zipObject(sourceIDs, miningSites) as { [sourceID: string]: MiningSite };
	}

	private spawnMoarOverlords(): void {
		this.overlords = {
			work     : new WorkerOverlord(this),
			logistics: new TransportOverlord(this),
		};
	}

	// /* Refreshes portions of the colony state between ticks without rebuilding the entire object */
	// rebuild(): void {
	// 	this.flags = []; 			// Reset flags list since Overmind will re-instantiate directives
	// 	this.overseer.rebuild();	// Rebuild the overseer, which rebuilds overlords
	// }

	getCreepsByRole(roleName: string): Zerg[] {
		return this.creepsByRole[roleName] || [];
	}

	/* Summarizes the total of all resources currently in a colony store structure */
	getAllAssets(): { [resourceType: string]: number } {
		let allAssets: { [resourceType: string]: number } = {};
		let storeStructures = _.compact([this.storage, this.terminal]) as StoreStructure[];
		for (let structure of storeStructures) {
			for (let resourceType in structure.store) {
				let amount = structure.store[<ResourceConstant>resourceType] || 0;
				if (!allAssets[resourceType]) {
					allAssets[resourceType] = 0;
				}
				allAssets[resourceType] += amount;
			}
		}
		return allAssets as StoreDefinition;
	}

	init(): void {
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.init());	// Initialize each hive cluster
		this.overseer.init();												// Initialize overseer AFTER hive clusters
		this.roadLogistics.init();											// Initialize the road network
		this.linkNetwork.init();											// Initialize link network
		this.roomPlanner.init();											// Initialize the room planner
	}

	run(): void {
		this.overseer.run();												// Run overseer BEFORE hive clusters
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.run());		// Run each hive cluster
		this.linkNetwork.run();												// Run the link network
		this.roadLogistics.run();											// Run the road network
		this.roomPlanner.run();												// Run the room planner
		// _.forEach(this.creeps, creep => creep.run());						// Animate all creeps
		this.stats();														// Log stats per tick
	}

	stats(): void {
		// Log energy and rcl
		Stats.log(`colonies.${this.name}.storage.energy`, this.storage ? this.storage.energy : undefined);
		Stats.log(`colonies.${this.name}.rcl.level`, this.controller.level);
		Stats.log(`colonies.${this.name}.rcl.progress`, this.controller.progress);
		Stats.log(`colonies.${this.name}.rcl.progressTotal`, this.controller.progressTotal);
		// Log average miningSite usage and uptime and estimated colony energy income
		let numSites = _.keys(this.miningSites).length;
		let avgDowntime = _.sum(_.map(this.miningSites, (site: MiningSite) => site.memory.stats.downtime)) / numSites;
		let avgUsage = _.sum(_.map(this.miningSites, (site: MiningSite) => site.memory.stats.usage)) / numSites;
		let energyInPerTick = _.sum(_.map(this.miningSites, (site: MiningSite) =>
			site.source.energyCapacity * site.memory.stats.usage)) / ENERGY_REGEN_TIME;
		Stats.log(`colonies.${this.name}.miningSites.avgDowntime`, avgDowntime);
		Stats.log(`colonies.${this.name}.miningSites.avgUsage`, avgUsage);
		Stats.log(`colonies.${this.name}.miningSites.energyInPerTick`, energyInPerTick);
	}

	visuals(): void {
		this.overseer.visuals();											// Display overlord creep information
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.visuals()); // Display hiveCluster visuals
	}
}
