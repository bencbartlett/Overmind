// Colony class - organizes all assets of an owned room into a colony

import {pathing} from './pathing/pathing';
import {MiningSite} from './hiveClusters/MiningSite';
import {Hatchery} from './hiveClusters/Hatchery';
import {CommandCenter} from './hiveClusters/CommandCenter';
import {UpgradeSite} from './hiveClusters/UpgradeSite';


export class Colony implements IColony {
	name: string;										// Name of the primary colony room
	memory: any;										// Memory.colonies[name]
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
	towers: StructureTower[];							// |
	labs: StructureLab[];								// |
	powerSpawn: StructurePowerSpawn | undefined;		// |
	nuker: StructureNuker | undefined;					// |
	observer: StructureObserver | undefined;			// |
	commandCenter: ICommandCenter | undefined;			// Component with logic for non-spawning structures
	hatchery: IHatchery;								// Component to encapsulate spawner logic
	upgradeSite: IUpgradeSite;							// Component to provide upgraders with uninterrupted energy
	miningGroups: IMiningGroup[]; 						// Component to group mining sites into a hauling group
	miningSites: { [sourceID: string]: IMiningSite };	// Component with logic for mining and hauling
	incubating: boolean;								// If the colony is currently being cared for by another one
	flags: Flag[];										// Flags across the colony
	creeps: ICreep[];									// Creeps bound to the colony
	creepsByRole: { [roleName: string]: ICreep[] };		// Creeps hashed by their role name
	sources: Source[];									// Sources in all colony rooms
	data: {												// Data about the colony, calculated once per tick
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
		// Get incubation status
		this.incubating = (_.filter(this.room.flags, flagCodes.territory.claimAndIncubate.filter).length > 0);
		// Register things across all rooms in the colony
		this.flags = _.flatten(_.map(this.rooms, room => room.flags));
		this.sources = _.flatten(_.map(this.rooms, room => room.sources));
	}

	/* Instantiate and associate virtual colony components to group similar structures together */
	private instantiateVirtualComponents(): void {
		// Instantiate the command center if there is storage in the room - this must be done first!
		if (this.storage && this.storage.linked) {
			this.commandCenter = new CommandCenter(this, this.storage);
		}
		// Instantiate the hatchery
		this.hatchery = new Hatchery(this, this.spawns[0]);
		// Instantiate the upgradeSite
		this.upgradeSite = new UpgradeSite(this, this.controller);
		// Instantiate a MiningGroup for each non-component link and for storage
		let claimedLinks = _.compact([this.commandCenter ? this.commandCenter.link : null,
									  this.hatchery ? this.hatchery.link : null,
									  this.upgradeSite.input]);
		let unclaimedLinks = _.filter(this.links, link => claimedLinks.includes(link) == false);
		// Mining sites is an object of ID's and MiningSites
		let sourceIDs = _.map(this.sources, source => source.ref);
		let miningSites = _.map(this.sources, source => new MiningSite(this, source));
		this.miningSites = _.zipObject(sourceIDs, miningSites) as { [sourceID: string]: MiningSite };
	}

	private populateColonyData(): void {
		// Calculate hauling power needed (in units of number of CARRY parts)
		let haulingPowerNeededValue: number;
		if (this.storage) {
			let haulingPower = 0;
			for (let siteID in this.miningSites) {
				let site = this.miningSites[siteID];
				if (site.output instanceof StructureContainer) { // only count container mining sites
					haulingPower += site.energyPerTick * (2 * pathing.cachedPathLength(this.storage.pos, site.pos));
				}
			}
			haulingPowerNeededValue = haulingPower / CARRY_CAPACITY;
		} else {
			haulingPowerNeededValue = 0;
		}
		// Hauling power currently supplied (in carry parts)
		let haulingPowerSuppliedValue = _.sum(_.map(this.getCreepsByRole('hauler'),
													creep => creep.getActiveBodyparts(CARRY)));
		let numHaulersValue = this.getCreepsByRole('hauler').length;
		this.data = {
			haulingPowerNeeded  : haulingPowerNeededValue,
			haulingPowerSupplied: haulingPowerSuppliedValue,
			numHaulers          : numHaulersValue,
		};
	}

	get overlord(): IOverlord {
		return Overmind.Overlords[this.name];
	}

	getCreepsByRole(roleName: string): ICreep[] {
		return this.creepsByRole[roleName] || [];
	}

	init(): void {
		// 1: Initialize the colony itself
		this.instantiateVirtualComponents();	// Instantiate the virtual components of the colony
		this.populateColonyData();				// Calculate relevant data about the colony per tick
		// 2: Initialize each colony component
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
		// 3: Initialize the colony overlord, must be run AFTER all components are initialized
		this.overlord.init();
		// 4: Initialize each creep in the colony
		for (let name in this.creeps) {
			this.creeps[name].init();
		}
	}

	run(): void {
		// 1: Run the colony overlord, must be run BEFORE all components are run
		this.overlord.run();
		// 2: Run the colony components
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
		// 3: Run the colony room TODO: (soon to be deprecated)
		this.room.run();
		// 4: Run each creep in the colony
		for (let name in this.creeps) {
			this.creeps[name].run();
		}
	}
}

