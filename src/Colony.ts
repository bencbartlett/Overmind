// Colony class - organizes all assets of an owned room into a colony

import {MiningSite} from './hiveClusters/hiveCluster_miningSite';
import {Hatchery} from './hiveClusters/hiveCluster_hatchery';
import {CommandCenter} from './hiveClusters/hiveCluster_commandCenter';
import {UpgradeSite} from './hiveClusters/hiveCluster_upgradeSite';
import {MiningGroup} from './hiveClusters/hiveCluster_miningGroup';
import {profile} from './lib/Profiler';

import {Overseer} from './Overseer';
import {SupplierOverlord} from './overlords/overlord_supply';
import {WorkerOverlord} from './overlords/overlord_work';
import {Zerg} from './Zerg';
import {RoomPlanner} from './roomPlanner/RoomPlanner';
import {HiveCluster} from './hiveClusters/HiveCluster';
import {LinkRequestGroup} from './logistics/LinkRequests';
import {TransportRequestGroup} from './logistics/TransportRequestGroup';
import {Priority} from './config/priorities';

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
	overseer: Overseer;								// This runs the directives and overlords
	// Room associations
	name: string;										// Name of the primary colony room
	colony: Colony;									// Reference to itself for simple overlord instantiation
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
	unclaimedLinks: StructureLink[]; 					// | Links not belonging to a hiveCluster, free for miningGroup
	claimedLinks: StructureLink[];						// | Links belonging to hive cluseters excluding mining groups
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
	miningGroups: { [id: string]: MiningGroup } | undefined;	// Component to group mining sites into a hauling group
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
	linkRequests: LinkRequestGroup;
	transportRequests: TransportRequestGroup;			// Box for resource requests
	// Overlords
	overlords: {
		supply: SupplierOverlord;
		work: WorkerOverlord;
	};
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
		this.spawns = _.filter(this.room.spawns, spawn => spawn.my);
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
		this.linkRequests = new LinkRequestGroup();
		this.transportRequests = new TransportRequestGroup();
		// Build the hive clusters
		this.hiveClusters = [];
		this.buildHiveClusters();
		// Register colony overlords
		this.spawnMoarOverlords();
		// Register a room planner
		this.roomPlanner = new RoomPlanner(this);
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
		// Sort claimed and unclaimed links
		let claimedLinkCandidates = _.compact([this.commandCenter ? this.commandCenter.link : null,
											   this.hatchery ? this.hatchery.link : null,
											   this.upgradeSite.input]);
		this.claimedLinks = _.filter(claimedLinkCandidates, s => s instanceof StructureLink) as StructureLink[];
		this.unclaimedLinks = _.filter(this.links, link => this.claimedLinks.includes(link) == false);
		// Instantiate a MiningGroup for each non-component link and for storage
		if (this.storage) {
			let miningGroupLinks = _.filter(this.unclaimedLinks, link => link.pos.rangeToEdge <= 3);
			let miningGroups: { [structRef: string]: MiningGroup } = {};
			miningGroups[this.storage.ref] = new MiningGroup(this, this.storage);
			for (let link of miningGroupLinks) {
				let createNewGroup = true;
				for (let structRef in miningGroups) {
					let group = miningGroups[structRef];
					if (group.links && group.links.includes(link)) {
						createNewGroup = false; // don't create a new group if one already includes this link
					}
				}
				if (createNewGroup) {
					miningGroups[link.ref] = new MiningGroup(this, link);
				}
			}
			this.miningGroups = miningGroups;
		}
		// Mining sites is an object of ID's and MiningSites
		let sourceIDs = _.map(this.sources, source => source.ref);
		let miningSites = _.map(this.sources, source => new MiningSite(this, source));
		this.miningSites = _.zipObject(sourceIDs, miningSites) as { [sourceID: string]: MiningSite };
	}

	private spawnMoarOverlords(): void {
		this.overlords = {
			supply: new SupplierOverlord(this),
			work  : new WorkerOverlord(this),
		};
	}

	/* Run the tower logic for each tower in the colony */
	private handleTowers(): void {
		for (let tower of this.towers) {
			tower.run();
		}
	}

	/* Examine the link resource requests and try to efficiently (but greedily) match links that need energy in and
	 * out, then send the remaining resourceOut link requests to the command center link */
	private handleLinks(): void {
		// For each receiving link, greedily get energy from the closest transmitting link - at most 9 operations
		for (let receiveLink of this.linkRequests.receive) {
			let closestTransmitLink = receiveLink.pos.findClosestByRange(this.linkRequests.transmit);
			// If a send-receive match is found, transfer that first, then remove the pair from the link lists
			if (closestTransmitLink) {
				// Send min of (all the energy in sender link, amount of available space in receiver link)
				let amountToSend = _.min([closestTransmitLink.energy, receiveLink.energyCapacity - receiveLink.energy]);
				closestTransmitLink.transferEnergy(receiveLink, amountToSend);
				_.remove(this.linkRequests.transmit, closestTransmitLink);
				_.remove(this.linkRequests.receive, receiveLink);
			}
		}
		// Now send all remaining transmit link requests to the command center
		if (this.commandCenter && this.commandCenter.link) {
			for (let transmitLink of this.linkRequests.transmit) {
				transmitLink.transferEnergy(this.commandCenter.link);
			}
		}
	}

	getCreepsByRole(roleName: string): Zerg[] {
		return this.creepsByRole[roleName] || [];
	}

	// /* Instantiate the virtual components of the colony and populate data */
	// build(): void {
	// 		}

	init(): void {
		// Initialize each hive cluster
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.init());
		// Register drop pickup requests // TODO: make this cleaner
		for (let room of this.rooms) {
			for (let drop of room.droppedEnergy) {
				this.transportRequests.requestWithdrawal(drop, Priority.High);
			}
		}
		// Initialize the colony overseer, must be run AFTER all components are initialized
		this.overseer.init();
		// Initialize the room planner
		this.roomPlanner.init();
	}

	run(): void {
		// 1: Run the colony overlord, must be run BEFORE all components are run
		this.overseer.run();
		// 2: Run the colony virtual components
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.run());
		// 3 Run the colony real components
		this.handleTowers();
		this.handleLinks();
		// 4: Run each creep in the colony
		_.forEach(this.creeps, creep => creep.run());
		// Run the room planner
		this.roomPlanner.run();
	}

	visuals(): void {
		// Display overlord creep information
		this.overseer.visuals();
		// Display hiveCluster visuals
		_.forEach(this.hiveClusters, hiveCluster => hiveCluster.visuals());
	}
}
