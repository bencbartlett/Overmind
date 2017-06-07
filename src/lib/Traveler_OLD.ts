// /**
//  * To start using Traveler, require it in main.js:
//  * Example: var Traveler = require('Traveler.js');
//  *
//  * Check the footer of this file for suggestions on how to access it at various scopes
//  *
//  */
//
// export interface TravelData {
// 	stuck: number;
// 	dest: RoomPosition;
// 	prev: RoomPosition;
// 	path: string;
// 	tick: number;
// 	cpu: number;
// 	count: number;
// }
//
// export interface TravelToOptions {
// 	ignoreRoads?: boolean;
// 	ignoreCreeps?: boolean;
// 	ignoreStuck?: boolean;
// 	ignoreStructures?: boolean;
// 	preferHighway?: boolean;
// 	allowHostile?: boolean;
// 	allowSK?: boolean;
// 	range?: number;
// 	obstacles?: { pos: RoomPosition }[];
// 	roomCallback?: (roomName: string, ignoreCreeps: boolean) => CostMatrix | boolean;
// 	routeCallback?: (roomName: string) => number;
// 	returnData?: { nextPos?: RoomPosition; };
// 	restrictDistance?: number;
// 	useFindRoute?: boolean;
// 	maxOps?: number;
// }
//
// interface PathfinderReturn {
// 	path: RoomPosition[];
// 	ops: number;
// 	cost: number;
// 	incomplete: boolean;
// }
//
// const REPORT_CPU_THRESHOLD = 100;
// const DEFAULT_MAXOPS = 20000;
// const DEFAULT_STUCK_VALUE = 5;
//
// export class Traveler {
//
// 	private memory: {
// 		hostileRooms: { [roomName: string]: number }
// 	};
// 	private structureMatrixCache: { [roomName: string]: CostMatrix };
// 	private creepMatrixCache: { [roomName: string]: CostMatrix };
// 	private currentTick: number;
//
// 	constructor() {
// 		// change this memory path to suit your needs
// 		if (!Memory.empire) {
// 			Memory.empire = {};
// 		}
// 		if (!Memory.empire.hostileRooms) {
// 			Memory.empire.hostileRooms = {};
// 		}
// 		this.memory = Memory.empire;
// 	}
//
// 	public findAllowedRooms(origin: string, destination: string,
// 							options: TravelToOptions = {}): { [roomName: string]: boolean } {
// 		_.defaults(options, {restrictDistance: 16});
// 		if (Game.map.getRoomLinearDistance(origin, destination) > options.restrictDistance) {
// 			return;
// 		}
// 		let allowedRooms = {[ origin ]: true, [ destination ]: true};
// 		let ret = Game.map.findRoute(origin, destination, {
// 			routeCallback: (roomName: string) => {
//
// 				if (options.routeCallback) {
// 					let outcome = options.routeCallback(roomName);
// 					if (outcome !== undefined) {
// 						return outcome;
// 					}
// 				}
//
// 				if (Game.map.getRoomLinearDistance(origin, roomName) > options.restrictDistance) {
// 					return false;
// 				}
// 				let parsed;
// 				if (options.preferHighway) {
// 					parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName) as any;
// 					let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
// 					if (isHighway) {
// 						return 1;
// 					}
// 				}
// 				if (!options.allowSK && !Game.rooms[roomName]) {
// 					if (!parsed) {
// 						parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName) as any;
// 					}
// 					let fMod = parsed[1] % 10;
// 					let sMod = parsed[2] % 10;
// 					let isSK = !(fMod === 5 && sMod === 5) &&
// 							   ((fMod >= 4) && (fMod <= 6)) &&
// 							   ((sMod >= 4) && (sMod <= 6));
// 					if (isSK) {
// 						return 10;
// 					}
// 				}
// 				if (!options.allowHostile && this.memory.hostileRooms[roomName] &&
// 					roomName !== destination && roomName !== origin) {
// 					return Number.POSITIVE_INFINITY;
// 				}
//
// 				return 2.5;
// 			},
// 		});
// 		if (!_.isArray(ret)) {
// 			console.log(`couldn't findRoute to ${destination}`);
// 			return;
// 		}
// 		for (let value of ret) {
// 			allowedRooms[value.room] = true;
// 		}
//
// 		return allowedRooms;
// 	}
//
// 	public findTravelPath(origin: { pos: RoomPosition }, destination: { pos: RoomPosition },
// 						  options: TravelToOptions = {}): PathfinderReturn {
// 		_.defaults(options, {
// 			ignoreCreeps: true,
// 			range       : 1,
// 			maxOps      : DEFAULT_MAXOPS,
// 			obstacles   : [],
// 		});
//
// 		let allowedRooms: { [roomName: string]: boolean };
// 		if (options.useFindRoute || (options.useFindRoute === undefined &&
// 									 Game.map.getRoomLinearDistance(origin.pos.roomName, destination.pos.roomName) > 2)) {
// 			allowedRooms = this.findAllowedRooms(origin.pos.roomName, destination.pos.roomName, options);
// 		}
//
// 		let callback = (roomName: string): CostMatrix | boolean => {
//
// 			if (options.roomCallback) {
// 				let outcome = options.roomCallback(roomName, options.ignoreCreeps);
// 				if (outcome !== undefined) {
// 					return outcome;
// 				}
// 			}
//
// 			if (allowedRooms) {
// 				if (!allowedRooms[roomName]) {
// 					return false;
// 				}
// 			} else if (this.memory.hostileRooms[roomName] && !options.allowHostile) {
// 				return false;
// 			}
//
// 			let room = Game.rooms[roomName];
// 			if (!room) {
// 				return;
// 			}
//
// 			let matrix: CostMatrix;
// 			if (options.ignoreStructures) {
// 				matrix = new PathFinder.CostMatrix();
// 				if (!options.ignoreCreeps) {
// 					Traveler.addCreepsToMatrix(room, matrix);
// 				}
// 			} else if (options.ignoreCreeps || roomName !== origin.pos.roomName) {
// 				matrix = this.getStructureMatrix(room);
// 			} else {
// 				matrix = this.getCreepMatrix(room);
// 			}
//
// 			for (let obstacle of options.obstacles) {
// 				matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
// 			}
//
// 			return matrix;
// 		};
//
// 		return PathFinder.search(origin.pos, {pos: destination.pos, range: options.range}, {
// 			maxOps      : options.maxOps,
// 			plainCost   : options.ignoreRoads ? 1 : 2,
// 			roomCallback: callback,
// 			swampCost   : options.ignoreRoads ? 5 : 10,
// 		});
// 	}
//
// 	public travelTo(creep: Creep, destination: RoomPosition | { pos: RoomPosition },
// 					options: TravelToOptions = {}): number {
// 		// Allow travelTo to accept roomPosition directly:
// 		if (destination instanceof RoomPosition) {
// 			destination = {pos: destination};
// 		}
//
// 		// register hostile rooms entered
// 		if (creep.room.controller) {
// 			if (creep.room.controller.owner && !creep.room.controller.my) {
// 				this.memory.hostileRooms[creep.room.name] = creep.room.controller.level;
// 			} else {
// 				this.memory.hostileRooms[creep.room.name] = undefined;
// 			}
// 		}
//
// 		// initialize data object
// 		if (!creep.memory._travel) {
// 			creep.memory._travel = {stuck: 0, tick: Game.time, cpu: 0, count: 0} as TravelData;
// 		}
// 		let travelData: TravelData = creep.memory._travel;
//
// 		if (creep.fatigue > 0) {
// 			travelData.tick = Game.time;
// 			return ERR_BUSY;
// 		}
//
// 		if (!destination) {
// 			return ERR_INVALID_ARGS;
// 		}
//
// 		// manage case where creep is nearby destination
// 		let rangeToDestination = creep.pos.getRangeTo(destination);
// 		if (rangeToDestination <= options.range) {
// 			return OK;
// 		} else if (rangeToDestination <= 1) {
// 			if (rangeToDestination === 1 && !options.range) {
// 				if (options.returnData) {
// 					options.returnData.nextPos = destination.pos;
// 				}
// 				return creep.move(creep.pos.getDirectionTo(destination));
// 			}
// 			return OK;
// 		}
//
// 		// check if creep is stuck
// 		let hasMoved = true;
// 		if (travelData.prev) {
// 			travelData.prev = Traveler.initPosition(travelData.prev);
// 			if (creep.pos.inRangeTo(travelData.prev, 0)) {
// 				hasMoved = false;
// 				travelData.stuck++;
// 			} else {
// 				travelData.stuck = 0;
// 			}
// 		}
//
// 		// handle case where creep is stuck
// 		if (travelData.stuck >= DEFAULT_STUCK_VALUE && !options.ignoreStuck) {
// 			options.ignoreCreeps = false;
// 			delete travelData.path;
// 		}
//
// 		// handle case where creep wasn't traveling last tick and may have moved, but destination is still the same
// 		if (Game.time - travelData.tick > 1 && hasMoved) {
// 			delete travelData.path;
// 		}
// 		travelData.tick = Game.time;
//
// 		// delete path cache if destination is different
// 		if (!travelData.dest || travelData.dest.x !== destination.pos.x || travelData.dest.y !== destination.pos.y ||
// 			travelData.dest.roomName !== destination.pos.roomName) {
// 			delete travelData.path;
// 		}
//
// 		// pathfinding
// 		if (!travelData.path) {
// 			if (creep.spawning) {
// 				return ERR_BUSY;
// 			}
//
// 			travelData.dest = destination.pos;
// 			travelData.prev = undefined;
// 			let cpu = Game.cpu.getUsed();
// 			let ret = this.findTravelPath(creep, destination, options);
// 			travelData.cpu += (Game.cpu.getUsed() - cpu);
// 			travelData.count++;
// 			if (travelData.cpu > REPORT_CPU_THRESHOLD) {
// 				console.log(`TRAVELER: heavy cpu use: ${creep.name}, cpu: ${_.round(travelData.cpu, 2)},\n` +
// 							`origin: ${creep.pos}, dest: ${destination.pos}`);
// 			}
// 			if (ret.incomplete) {
// 				console.log(`TRAVELER: incomplete path for ${creep.name}`);
// 				if (ret.ops < 2000 && options.useFindRoute === undefined && travelData.stuck < DEFAULT_STUCK_VALUE) {
// 					options.useFindRoute = false;
// 					ret = this.findTravelPath(creep, destination, options);
// 					console.log(`attempting path without findRoute was ${ret.incomplete ? 'not' : ''} successful`);
// 				}
// 			}
// 			travelData.path = Traveler.serializePath(creep.pos, ret.path);
// 			travelData.stuck = 0;
// 		}
// 		if (!travelData.path || travelData.path.length === 0) {
// 			return ERR_NO_PATH;
// 		}
//
// 		// consume path and move
// 		if (travelData.prev && travelData.stuck === 0) {
// 			travelData.path = travelData.path.substr(1);
// 		}
// 		travelData.prev = creep.pos;
// 		let nextDirection = parseInt(travelData.path[0], 10);
// 		if (options.returnData) {
// 			options.returnData.nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
// 		}
// 		return creep.move(nextDirection);
// 	}
//
// 	public getStructureMatrix(room: Room): CostMatrix {
// 		this.refreshMatrices();
// 		if (!this.structureMatrixCache[room.name]) {
// 			let matrix = new PathFinder.CostMatrix();
// 			this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(room, matrix, 1);
// 		}
// 		return this.structureMatrixCache[room.name];
// 	}
//
// 	public static initPosition(pos: RoomPosition) {
// 		return new RoomPosition(pos.x, pos.y, pos.roomName);
// 	}
//
// 	public static addStructuresToMatrix(room: Room, matrix: CostMatrix, roadCost: number): CostMatrix {
// 		let impassibleStructures: Structure[] = [];
// 		for (let structure of room.find<Structure>(FIND_STRUCTURES)) {
// 			if (structure instanceof StructureRampart) {
// 				if (!structure.my) {
// 					impassibleStructures.push(structure);
// 				}
// 			} else if (structure instanceof StructureRoad) {
// 				matrix.set(structure.pos.x, structure.pos.y, roadCost);
// 			} else if (structure instanceof StructureContainer) {
// 				matrix.set(structure.pos.x, structure.pos.y, 5);
// 			} else {
// 				impassibleStructures.push(structure);
// 			}
// 		}
//
// 		for (let site of room.find<ConstructionSite>(FIND_MY_CONSTRUCTION_SITES)) {
// 			if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD
// 				|| site.structureType === STRUCTURE_RAMPART) {
// 				continue;
// 			}
// 			matrix.set(site.pos.x, site.pos.y, 0xff);
// 		}
//
// 		for (let structure of impassibleStructures) {
// 			matrix.set(structure.pos.x, structure.pos.y, 0xff);
// 		}
//
// 		return matrix;
// 	}
//
// 	public getCreepMatrix(room: Room) {
// 		this.refreshMatrices();
// 		if (!this.creepMatrixCache[room.name]) {
// 			this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(room, this.getStructureMatrix(room).clone());
// 		}
// 		return this.creepMatrixCache[room.name];
// 	}
//
// 	public static addCreepsToMatrix(room: Room, matrix: CostMatrix): CostMatrix {
// 		room.find<Creep>(FIND_CREEPS).forEach((creep: Creep) => matrix.set(creep.pos.x, creep.pos.y, 0xff));
// 		return matrix;
// 	}
//
// 	public static serializePath(startPos: RoomPosition, path: RoomPosition[]): string {
// 		let serializedPath = '';
// 		let lastPosition = startPos;
// 		for (let position of path) {
// 			if (position.roomName === lastPosition.roomName) {
// 				serializedPath += lastPosition.getDirectionTo(position);
// 			}
// 			lastPosition = position;
// 		}
// 		return serializedPath;
// 	}
//
// 	private refreshMatrices() {
// 		if (Game.time !== this.currentTick) {
// 			this.currentTick = Game.time;
// 			this.structureMatrixCache = {};
// 			this.creepMatrixCache = {};
// 		}
// 	}
//
// 	private static positionAtDirection(origin: RoomPosition, direction: number): RoomPosition {
// 		let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
// 		let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
// 		return new RoomPosition(origin.x + offsetX[direction], origin.y + offsetY[direction], origin.roomName);
// 	}
// }
