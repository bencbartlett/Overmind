// Colony class - organizes all assets of an owned room into a colony

import {MiningSite} from './hiveClusters/MiningSite';
import {Hatchery} from './hiveClusters/Hatchery';
import {CommandCenter} from './hiveClusters/CommandCenter';
import {UpgradeSite} from './hiveClusters/UpgradeSite';
import {MiningGroup} from './hiveClusters/MiningGroup';
import {profileClass} from './profiling';
import {pathing} from './pathing/pathing';

export class Colony implements IColony {
	name: string;										// Name of the primary colony room
	memory: ColonyMemory;								// Memory.colonies[name]
	roomNames: string[];								// The names of all rooms including the primary room
	room: Room;											// Primary (owned) room of the colony
	outposts: Room[];									// Rooms for remote resource collection
	rooms: Room[];										// All rooms including the primary room
	controller: StructureController;					// These are all duplicated from room properties
	spawns: StructureSpawn[];							// |
	extensions: StructureExtension[];					// |
	storage: StructureStorage | undefined;				// |
	links: StructureLink[];								// |
	terminal: StructureTerminal | undefined;			// |
	towers: StructureTower[];							// | All towers, including those owned by a virtual component
	labs: StructureLab[];								// |
	powerSpawn: StructurePowerSpawn | undefined;		// |
	nuker: StructureNuker | undefined;					// |
	observer: StructureObserver | undefined;			// |
	commandCenter: ICommandCenter | undefined;			// Component with logic for non-spawning structures
	hatchery: IHatchery | undefined;					// Component to encapsulate spawner logic
	upgradeSite: IUpgradeSite;							// Component to provide upgraders with uninterrupted energy
	claimedLinks: StructureLink[];						// Links belonging to hive cluseters excluding mining groups
	unclaimedLinks: StructureLink[]; 					// Links not belonging to a hive cluster, free for mining group
	miningGroups: { [id: string]: IMiningGroup } | undefined;	// Component to group mining sites into a hauling group
	miningSites: { [sourceID: string]: IMiningSite };	// Component with logic for mining and hauling
	sources: Source[];									// Sources in all colony rooms
	incubator: IColony | undefined; 					// The colony responsible for incubating this one, if any
	isIncubating: boolean;								// If the colony is incubating
	incubatingColonies: IColony[];						// List of colonies that this colony is incubating
	stage: 												// The stage of the colony "lifecycle"
		'larva' |										// No storage and no incubator
		'pupa' |										// Has storage but RCL < 8
		'adult';										// RCL 8 room
	defcon: 0 | 1 | 2 | 3 | 4 | 5; 						// Defensive alert level of the colony
	flags: Flag[];										// Flags across the colony
	creeps: ICreep[];									// Creeps bound to the colony
	creepsByRole: { [roleName: string]: ICreep[] };		// Creeps hashed by their role name
	hostiles: Creep[];									// Hostile creeps in one of the rooms
	data: {												// Data about the colony, calculated once per tick
		energyPerTick: number, 								// Energy income of the colony per tick
		numHaulers: number,									// Number of haulers in the colony
		haulingPowerSupplied: number,						// Amount of hauling supplied in units of CARRY parts
		haulingPowerNeeded: number,							// Amount of hauling needed in units of CARRY parts
	};

	constructor(roomName: string, outposts: string[]) {
		// Name the colony
		this.name = roomName;
		// Set up memory if needed
		if (!Memory.colonies[this.name]) {
			Memory.colonies[this.name] = {
				overlord     : {},
				hatchery     : {},
				commandCenter: {},
			};
		}
		this.memory = Memory.colonies[this.name];
		// Register colony capitol and associated components
		this.roomNames = [roomName].concat(outposts);
		this.room = Game.rooms[roomName];
		this.outposts = _.compact(_.map(outposts, outpost => Game.rooms[outpost]));
		this.rooms = [Game.rooms[roomName]].concat(this.outposts);
		// Associate real colony components
		this.controller = this.room.controller!; // must be controller since colonies are based in owned rooms
		this.spawns = this.room.spawns;
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
		if (this.storage && this.controller.level == 8) {
			this.stage = 'adult';
		} else if (this.storage && this.controller.level < 8) {
			this.stage = 'pupa';
		} else {
			this.stage = 'larva';
		}
		this.isIncubating = false;
		// Defcon starts at 0, is updated in initDefconLevel()
		this.defcon = 0;
		// Register physical objects across all rooms in the colony
		this.sources = _.flatten(_.map(this.rooms, room => room.sources));
		// Register enemies across colony rooms
		this.hostiles = _.flatten(_.map(this.rooms, room => room.hostiles));
		// Create placeholder arrays for remaining properties to be filled in by the Overmind
		this.creeps = []; // This is done by Overmind.registerCreeps()
		this.creepsByRole = {};
		this.flags = [];
		this.incubatingColonies = [];
	}

	/* Instantiate and associate virtual colony components to group similar structures together */
	private instantiateVirtualComponents(): void {
		// Instantiate the command center if there is storage in the room - this must be done first!
		if (this.storage && this.storage.linked) {
			this.commandCenter = new CommandCenter(this, this.storage);
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
		this.claimedLinks = _.filter(_.compact([this.commandCenter ? this.commandCenter.link : null,
												this.hatchery ? this.hatchery.link : null,
												this.upgradeSite.input]), s => s instanceof StructureLink) as Link[];
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


	private populateColonyData(): void { // TODO: cache this
		// Calculate hauling power needed (in units of number of CARRY parts)
		let energyPerTickValue = _.sum(_.map(this.miningSites, site => site.energyPerTick));
		let haulingPower = 0;
		for (let siteID in this.miningSites) {
			let site = this.miningSites[siteID];
			if (site.output instanceof StructureContainer) { // only count container mining sites
				if (this.storage) {
					haulingPower += site.energyPerTick * (2 * pathing.cachedPathLength(this.storage.pos, site.pos));
				} else { // if there is no storage, use controller position as a benchmark
					haulingPower += site.energyPerTick * (2 * pathing.cachedPathLength(this.controller.pos, site.pos));
				}
			}
		}
		let haulingPowerNeededValue = haulingPower / CARRY_CAPACITY;

		// Hauling power currently supplied (in carry parts)
		let haulingPowerSuppliedValue = _.sum(_.map(this.getCreepsByRole('hauler'),
													creep => creep.getActiveBodyparts(CARRY)));
		let numHaulersValue = this.getCreepsByRole('hauler').length;
		this.data = {
			energyPerTick       : energyPerTickValue,
			haulingPowerNeeded  : haulingPowerNeededValue,
			haulingPowerSupplied: haulingPowerSuppliedValue,
			numHaulers          : numHaulersValue,
		};
	}

	// private initDefconLevel(): void {
	// 	if (this.hostiles.length > 0) {
	// 		this.defcon = 1;
	// 	}
	// }

	/* Run the tower logic for each tower in the colony */
	private handleTowers(): void {
		for (let tower of this.towers) {
			tower.run();
		}
	}

	/* Examine the link resource requests and try to efficiently (but greedily) match links that need energy in and
	 * out, then send the remaining resourceOut link requests to the command center link */
	private handleLinks(): void {
		// Generate lists of links that want to send or receive energy
		let transmitRequests = this.overlord.resourceRequests.resourceOut.link;
		let receiveRequests = this.overlord.resourceRequests.resourceIn.link;
		if (this.miningGroups) {
			transmitRequests = transmitRequests.concat(
				_.flatten(_.map(this.miningGroups, group => group.resourceRequests.resourceOut.link)));
			receiveRequests = receiveRequests.concat(
				_.flatten(_.map(this.miningGroups, group => group.resourceRequests.resourceIn.link)));
		}
		let transmitLinks = _.map(transmitRequests, request => request.target) as Link[];
		let receiveLinks = _.map(receiveRequests, request => request.target) as Link[];
		// For each receiving link, greedily get energy from the closest transmitting link - at most 9 operations
		for (let receiveLink of receiveLinks) {
			let closestTransmitLink = receiveLink.pos.findClosestByRange(transmitLinks);
			// If a send-receive match is found, transfer that first, then remove the pair from the link lists
			if (closestTransmitLink) {
				// Send min of (all the energy in sender link, amount of available space in receiver link)
				let amountToSend = _.min([closestTransmitLink.energy, receiveLink.energyCapacity - receiveLink.energy]);
				closestTransmitLink.transferEnergy(receiveLink, amountToSend);
				_.remove(transmitLinks, link => link == closestTransmitLink);
				_.remove(receiveLinks, link => link == receiveLink);
			}
		}
		// Now send all remaining transmit link requests to the command center
		if (this.commandCenter && this.commandCenter.link) {
			for (let transmitLink of transmitLinks) {
				transmitLink.transferEnergy(this.commandCenter.link);
			}
		}
	}

	get overlord(): IOverlord {
		return Overmind.Overlords[this.name];
	}

	getCreepsByRole(roleName: string): ICreep[] {
		return this.creepsByRole[roleName] || [];
	}

	/* Instantiate the virtual components of the colony and populate data */
	build(): void {
		this.instantiateVirtualComponents();	// Instantiate the virtual components of the colony
		this.populateColonyData();				// Calculate relevant data about the colony per tick
	}

	init(): void {
		// 1: Initialize each colony component
		if (this.hatchery) {
			this.hatchery.init();
		}
		if (this.commandCenter) {
			this.commandCenter.init();
		}
		if (this.upgradeSite) {
			this.upgradeSite.init();
		}
		for (let siteID in this.miningSites) {
			let site = this.miningSites[siteID];
			site.init();
		}
		if (this.miningGroups) { // Mining groups must be initialized after mining sites
			for (let groupID in this.miningGroups) {
				this.miningGroups[groupID].init();
			}
		}
		// 2: Initialize the colony overlord, must be run AFTER all components are initialized
		this.overlord.init();
		// 3: Initialize each creep in the colony
		for (let name in this.creeps) {
			this.creeps[name].init();
		}
	}

	run(): void {
		// 1: Run the colony overlord, must be run BEFORE all components are run
		this.overlord.run();
		// 2: Run the colony virtual components
		if (this.hatchery) {
			this.hatchery.run();
		}
		if (this.commandCenter) {
			this.commandCenter.run();
		}
		if (this.upgradeSite) {
			this.upgradeSite.run();
		}
		for (let siteID in this.miningSites) {
			let site = this.miningSites[siteID];
			site.run();
		}
		if (this.miningGroups) {
			for (let groupID in this.miningGroups) {
				this.miningGroups[groupID].run();
			}
		}
		// 3 Run the colony real components
		this.handleTowers();
		this.handleLinks();
		// 4: Run each creep in the colony
		for (let name in this.creeps) {
			this.creeps[name].run();
		}
	}
}

profileClass(Colony);
