// Colony class - organizes all assets of an owned room into a colony

import {profile} from './profiler/decorator';
import {MiningSite} from './hiveClusters/hiveCluster_miningSite';
import {Hatchery} from './hiveClusters/hiveCluster_hatchery';
import {CommandCenter} from './hiveClusters/hiveCluster_commandCenter';
import {UpgradeSite} from './hiveClusters/hiveCluster_upgradeSite';
import {Overseer} from './Overseer';
// import {SupplierOverlord} from './overlords/core/overlord_supply';
import {WorkerOverlord} from './overlords/core/overlord_work';
import {Zerg} from './Zerg';
import {RoomPlanner} from './roomPlanner/RoomPlanner';
import {HiveCluster} from './hiveClusters/HiveCluster';
import {LinkNetwork} from './logistics/LinkNetwork';
import {Stats} from './stats/stats';
import {SporeCrawler} from './hiveClusters/hiveCluster_sporeCrawler';
import {RoadLogistics} from './logistics/RoadLogistics';
import {LogisticsGroup} from './logistics/LogisticsGroup';
import {TransportOverlord} from './overlords/core/overlord_transport';

export enum ColonyStage {
	Larva = 0,		// No storage and no incubator
	Pupa  = 1,		// Has storage but RCL < 8
	Adult = 2,		// RCL 8 room
}

@profile
export class Colony {
	// Colony memory
	memory: ColonyMemory;								// Memory.colonies[name]
	// Colony overseer
	overseer: Overseer;									// This runs the directives and overlords
	// Room associations
	name: string;										// Name of the primary colony room
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
	sources: Source[];									// | Sources in all colony rooms
	flags: Flag[];										// | Flags across the colony
	constructionSites: ConstructionSite[];				// | Construction sites in all colony rooms
	repairables: Structure[];
	// Hive clusters
	hiveClusters: HiveCluster[];						// List of all hive clusters
	commandCenter: CommandCenter | undefined;			// Component with logic for non-spawning structures
	hatchery: Hatchery | undefined;						// Component to encapsulate spawner logic
	upgradeSite: UpgradeSite;							// Component to provide upgraders with uninterrupted energy
	sporeCrawlers: SporeCrawler[];
	miningSites: { [sourceID: string]: MiningSite };	// Component with logic for mining and hauling
	// Incubation status
	incubator: Colony | undefined; 						// The colony responsible for incubating this one, if any
	isIncubating: boolean;								// If the colony is incubating
	incubatingColonies: Colony[];						// List of colonies that this colony is incubating
	level: number; 										// Level of the colony's main room
	stage: number;										// The stage of the colony "lifecycle"
	// Creeps and subsets
	creeps: Zerg[];										// Creeps bound to the colony
	creepsByRole: { [roleName: string]: Zerg[] };		// Creeps hashed by their role name
	hostiles: Creep[];									// Hostile creeps in one of the rooms
	// Resource requests
	linkNetwork: LinkNetwork;
	logisticsGroup: LogisticsGroup;
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

	constructor(roomName: string, outposts: string[]) {
		// Name the colony
		this.name = roomName;
		this.colony = this;
		// Set up memory if needed
		if (!Memory.colonies[this.name]) {
			Memory.colonies[this.name] = {
				overseer     : <OverseerMemory>{},
				hatchery     : <HatcheryMemory>{},
				commandCenter: <CommandCenterMemory>{},
			};
		}
		this.memory = Memory.colonies[this.name];
		// Instantiate the colony overseer
		this.overseer = new Overseer(this);
		// Register colony capitol and associated components
		this.roomNames = [roomName].concat(outposts);
		this.room = Game.rooms[roomName];
		this.outposts = _.compact(_.map(outposts, outpost => Game.rooms[outpost]));
		this.rooms = [Game.rooms[roomName]].concat(this.outposts);
		// Associate real colony components
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
		// Set the colony stage
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
		// Register physical objects across all rooms in the colony
		this.sources = _.flatten(_.map(this.rooms, room => room.sources));
		this.constructionSites = _.flatten(_.map(this.rooms, room => room.constructionSites));
		this.repairables = _.flatten(_.map(this.rooms, room => room.repairables));
		// Register enemies across colony rooms
		this.hostiles = _.flatten(_.map(this.rooms, room => room.hostiles));
		// Create placeholder arrays for remaining properties to be filled in by the Overmind
		this.creeps = []; // This is done by Overmind.registerCreeps()
		this.creepsByRole = {};
		this.flags = [];
		this.incubatingColonies = [];
		// Resource requests
		this.linkNetwork = new LinkNetwork(this);
		// this.transportRequests = new TransportRequestGroup();
		this.logisticsGroup = new LogisticsGroup(this);
		// this.logisticsNetwork = new LogisticsNetwork(this);
		// Register a room planner
		this.roomPlanner = new RoomPlanner(this);
		// Register road network
		this.roadLogistics = new RoadLogistics(this);
		// Build the hive clusters
		this.hiveClusters = [];
		this.buildHiveClusters();
		// Register colony overlords
		this.spawnMoarOverlords();
	}

	/* Instantiate and associate virtual colony components to group similar structures together */
	private buildHiveClusters(): void {
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
		let claimedLinkCandidates = _.compact([this.commandCenter ? this.commandCenter.link : null,
											   this.hatchery ? this.hatchery.link : null,
											   this.upgradeSite.input]);
		this.claimedLinks = _.filter(claimedLinkCandidates, s => s instanceof StructureLink) as StructureLink[];
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

	getCreepsByRole(roleName: string): Zerg[] {
		return this.creepsByRole[roleName] || [];
	}


	init(): void {
		// Initialize each hive cluster
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.init());
		// Register drop pickup requests // TODO: make this cleaner, refactor for tombstones
		// for (let room of this.rooms) {
		// 	for (let drop of room.droppedEnergy) {
		// 		// this.transportRequests.requestWithdrawal(drop, Priority.High);
		// 		this.logisticsGroup.provide(drop,{multiplier:1.5});
		// 	}
		// }
		// Initialize the colony overseer, must be run AFTER all components are initialized
		this.overseer.init();
		// Initialize the road network
		this.roadLogistics.init();
		// Initialize link network
		this.linkNetwork.init();
		// Initialize the room planner
		this.roomPlanner.init();
		// console.log('==================================================================================');

		// if (true) {
		// 	console.log('==================================================================================');
		// 	console.log(`Summary of logistics group for ${this.colony.name} at init() ${Game.time}`);
		// 	this.logisticsGroup.summarize();
		// }
	}

	run(): void {
		// 1: Run the colony overlord, must be run BEFORE all components are run
		this.overseer.run();
		// 2: Run the colony virtual components
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.run());
		// Run the link network
		this.linkNetwork.run();
		// 4: Run each creep in the colony
		_.forEach(this.creeps, creep => creep.run());
		// Run the road network
		this.roadLogistics.run();
		// Run the room planner
		this.roomPlanner.run();
		// Record statistics
		this.stats();
		// if (true) {
		// 	console.log(`Summary of logistics group for ${this.colony.name} at run() ${Game.time}`);
		// 	this.logisticsGroup.summarize();
		// }
	}

	stats(): void {
		Stats.log(`colonies.${this.name}.storage.energy`, this.storage ? this.storage.energy : undefined);
		Stats.log(`colonies.${this.name}.rcl.level`, this.controller.level);
		Stats.log(`colonies.${this.name}.rcl.progress`, this.controller.progress);
		Stats.log(`colonies.${this.name}.rcl.progressTotal`, this.controller.progressTotal);
	}

	visuals(): void {
		// Display overlord creep information
		this.overseer.visuals();
		// Display hiveCluster visuals
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.visuals());
	}
}
