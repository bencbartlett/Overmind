// Overmind class - manages colony-scale operations and contains references to all brain objects

import profiler = require('./lib/screeps-profiler');
import {Colony} from './Colony';
import {Overlord} from './Overlord';
import {AbstractCreepWrapper} from './maps/map_roles';

export default class Overmind implements IOvermind {
	name: string;											// I AM THE SWARM
	Colonies: { [roomName: string]: Colony };				// Global hash of all colony objects
	colonyMap: { [roomName: string]: string };				// Global map of colony associations for possibly-null rooms
	invisibleRooms: string[]; 								// Names of rooms across all colonies that are invisible
	Overlords: { [roomName: string]: Overlord };			// Global hash of colony overlords
	// TerminalBrains: { [roomName: string]: TerminalBrain };	// Global hash of terminal brains TODO: deprecate soon

	constructor() {
		this.name = 'Overmind';
		this.Colonies = {};
		this.colonyMap = {};
		this.invisibleRooms = [];
		this.Overlords = {};
		// this.TerminalBrains = {};
	}

	/* Ensure top-level memory values are initialized */
	private verifyMemory(): void {
		if (!Memory.Overmind) {
			Memory.Overmind = {};
		}
		if (!Memory.colonies) {
			Memory.colonies = {};
		}
	}

	/* Instantiate a new colony for each owned rom */
	private initializeColonies(): void {
		// Colony call object
		let protoColonies = {} as { [roomName: string]: string[] }; // key: lead room, values: outposts[]
		// Register colony capitols
		for (let name in Game.rooms) {
			if (Game.rooms[name].my) { // Add a new colony for each owned room
				Game.rooms[name].memory.colony = name; // register colony to itself
				protoColonies[name] = [];
			}
		}
		// Register colony outposts
		let colonyFlags = _.filter(Game.flags, flagCodes.territory.colony.filter);
		for (let flag of colonyFlags) {
			let colonyName = flag.name.split(':')[1];
			if (colonyName) {
				let roomName = flag.pos.roomName;
				this.colonyMap[roomName] = colonyName; // Create an association between room and colony name
				let thisRoom = Game.rooms[roomName];
				if (thisRoom) {
					thisRoom.memory.colony = colonyName;
				} else {
					this.invisibleRooms.push(roomName); // register room as invisible to be handled by observer
				}
				protoColonies[colonyName].push(roomName);
			}
		}
		// Initialize the colonies
		for (let colName in protoColonies) {
			this.Colonies[colName] = new Colony(colName, protoColonies[colName]);
		}
	}

	/* Instantiate a colony overlord for each colony */
	private spawnMoarOverlords(): void {
		// Instantiate an overlord for each colony
		for (let name in this.Colonies) {
			this.Overlords[name] = new Overlord(this.Colonies[name]);
		}
	}

	// initializeTerminalBrains(): void {
	// 	for (let name in this.Colonies) {
	// 		if (Game.rooms[name].terminal) {
	// 			this.TerminalBrains[name] = new TerminalBrain(name);
	// 		}
	// 	}
	// }

	/* Wrap each creep in a role-contextualized wrapper */
	private initializeCreeps(): void {
		// Wrap all creeps
		Game.icreeps = {};
		for (let name in Game.creeps) {
			Game.icreeps[name] = AbstractCreepWrapper(Game.creeps[name]);
		}
		// Register creeps
		let creepsByColony = _.groupBy(Game.icreeps, creep => creep.memory.colony) as { [colName: string]: ICreep[] };
		for (let colName in this.Colonies) {
			let colony = this.Colonies[colName];
			let colCreeps: ICreep[] = creepsByColony[colName];
			colony.creeps = colCreeps;
			colony.creepsByRole = _.groupBy(colCreeps, creep => creep.memory.role);
		}
	}

	private handleObservers(): void {
		// Shuffle list of invisible rooms to allow different ones to be observed each tick
		this.invisibleRooms = _.shuffle(this.invisibleRooms);
		// Generate a map of available observers
		let availableObservers: { [colonyName: string]: StructureObserver } = {};
		for (let colonyName in this.Colonies) {
			let colony = this.Colonies[colonyName];
			if (colony.observer) {
				availableObservers[colonyName] = colony.observer;
			}
		}
		// Loop until you run out of rooms to observe or observers
		while (this.invisibleRooms.length > 0 && _.size(availableObservers) > 0) {
			let roomName = this.invisibleRooms.shift();
			if (roomName) {
				let colonyName = this.colonyMap[roomName];
				if (availableObservers[colonyName]) {
					availableObservers[colonyName].observeRoom(roomName);
					delete availableObservers[colonyName];
				} else {
					let observerRooms = _.keys(availableObservers);
					let inRangeRoom = _.find(observerRooms,
											 oRoomName => Game.map.getRoomLinearDistance(oRoomName, roomName!)
														  <= OBSERVER_RANGE);
					if (inRangeRoom) {
						availableObservers[inRangeRoom].observeRoom(roomName);
						delete availableObservers[colonyName];
					}
				}
			}
		}
	}

	/* Intialize everything in pre-init phase of main loop. Does not call colony.init(). */
	init(): void {
		this.verifyMemory();
		this.initializeColonies();
		this.spawnMoarOverlords();
		// this.initializeTerminalBrains();
		this.initializeCreeps();
	}

	run(): void {
		this.handleObservers();
	}
};


profiler.registerClass(Overmind, 'Overmind');

