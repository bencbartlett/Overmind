import {log} from '../console/log';
import {profile} from '../profiler/decorator';
import {ROOMTYPE_ALLEY, ROOMTYPE_SOURCEKEEPER, WorldMap} from '../utilities/WorldMap';
import {Zerg} from '../Zerg';

/* Module for pathing-related operations. */

const DEFAULT_MAXOPS = 20000;		// Default timeout for pathfinding

@profile
export class Pathing {

	// Room avoidance methods ==========================================================================================

	/* Check if the room should be avoiding when calculating routes */
	static shouldAvoid(roomName: string) {
		return Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].avoid;
	}

	/* Update memory on whether a room should be avoided based on controller owner */
	static updateRoomStatus(room: Room) {
		if (!room) {
			return;
		}
		if (room.controller) {
			if (room.controller.owner && !room.controller.my && room.towers.length > 0) {
				room.memory.avoid = 1;
			} else {
				delete room.memory.avoid;
			}
		}
	}

	// Pathfinding and room callback methods ===========================================================================

	/* Find a path from origin to destination */
	static findPath(origin: RoomPosition, destination: RoomPosition, options: MoveOptions = {}): PathFinderPath {
		_.defaults(options, {
			ignoreCreeps: true,
			maxOps      : DEFAULT_MAXOPS,
			range       : 1,
		});

		if (options.movingTarget) {
			options.range = 0;
		}

		// check to see whether findRoute should be used
		let roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
		let allowedRooms = options.route;
		if (!allowedRooms && (options.useFindRoute || (options.useFindRoute == undefined && roomDistance > 2))) {
			allowedRooms = this.findRoute(origin.roomName, destination.roomName, options);
		}

		let callback = (roomName: string) => this.roomCallback(roomName, origin, destination, allowedRooms, options);
		let ret = PathFinder.search(origin, {pos: destination, range: options.range!}, {
			maxOps      : options.maxOps,
			maxRooms    : options.maxRooms,
			plainCost   : options.offRoad ? 1 : options.ignoreRoads ? 1 : 2,
			swampCost   : options.offRoad ? 1 : options.ignoreRoads ? 5 : 10,
			roomCallback: callback,
		});

		if (ret.incomplete && options.ensurePath) {
			if (options.useFindRoute == undefined) {
				// handle case where pathfinder failed at a short distance due to not using findRoute
				// can happen for situations where the creep would have to take an uncommonly indirect path
				// options.allowedRooms and options.routeCallback can also be used to handle this situation
				if (roomDistance <= 2) {
					log.warning(`Movement: path failed without findroute. Origin: ${origin.print}, ` +
								`destination: ${destination.print}. Trying again with options.useFindRoute = true...`);
					options.useFindRoute = true;
					ret = this.findPath(origin, destination, options);
					log.warning(`Movement: second attempt was ${ret.incomplete ? 'not ' : ''}successful`);
					return ret;
				}
			} else {

			}
		}
		return ret;
	}

	private static roomCallback(roomName: string, origin: RoomPosition, destination: RoomPosition,
								allowedRooms: { [roomName: string]: boolean } | undefined,
								options: MoveOptions): CostMatrix | boolean {
		if (allowedRooms && !allowedRooms[roomName]) {
			return false;
		}
		if (!options.allowHostile && this.shouldAvoid(roomName)
			&& roomName != origin.roomName && roomName != destination.roomName) {
			return false;
		}

		const room = Game.rooms[roomName];
		if (room) {
			return this.getCostMatrix(room, options, false);
		} else { // have no vision
			return true;
		}
	}

	// Cost matrix computations ========================================================================================

	/* Get a cloned copy of the cost matrix for a room with specified options */
	static getCostMatrix(room: Room, options = {} as MoveOptions, clone = true): CostMatrix {
		let matrix: CostMatrix;
		if (options.ignoreCreeps == false) {
			matrix = this.getCreepMatrix(room);
		} else if (options.avoidSK && WorldMap.roomType(room.name) == ROOMTYPE_SOURCEKEEPER) {
			matrix = this.getSkMatrix(room);
		} else {
			matrix = this.getDefaultMatrix(room);
		}
		// Register other obstacles
		if (options.obstacles) {
			matrix = matrix.clone();
			for (let obstacle of options.obstacles) {
				if (obstacle && obstacle.roomName == room.name) {
					matrix.set(obstacle.x, obstacle.y, 0xff);
				}
			}
		}
		if (clone) {
			matrix = matrix.clone();
		}
		return matrix;
	}

	/* Default matrix for a room, setting impassable structures and constructionSites to impassible */
	private static getDefaultMatrix(room: Room): CostMatrix {
		if (room._defaultMatrix) {
			return room._defaultMatrix;
		}
		const matrix = new PathFinder.CostMatrix();
		// Set passability of structure positions
		let impassibleStructures: Structure[] = [];
		_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
			if (s.structureType == STRUCTURE_ROAD) {
				matrix.set(s.pos.x, s.pos.y, 1);
			} else if (s.blocksMovement) {
				impassibleStructures.push(s);
			}
		});
		_.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
		// Set passability of construction sites
		_.forEach(room.find(FIND_CONSTRUCTION_SITES), (cs: ConstructionSite): void => {
			if (cs.my && cs.structureType != STRUCTURE_RAMPART &&
				cs.structureType != STRUCTURE_ROAD && cs.structureType != STRUCTURE_CONTAINER) {
				matrix.set(cs.pos.x, cs.pos.y, 0xff);
			}
		});
		room._defaultMatrix = matrix;
		return room._defaultMatrix;
	}

	/* Avoids creeps in a room */
	private static getCreepMatrix(room: Room): CostMatrix {
		if (room._creepMatrix) {
			return room._creepMatrix;
		}
		const matrix = this.getDefaultMatrix(room).clone();
		_.forEach(room.find(FIND_CREEPS), c => matrix.set(c.pos.x, c.pos.y, 0xff));
		room._creepMatrix = matrix;
		return room._creepMatrix;
	}

	/* Avoids source keepers in a room */
	private static getSkMatrix(room: Room): CostMatrix {
		if (room._skMatrix) {
			return room._skMatrix;
		}
		const matrix = this.getDefaultMatrix(room).clone();
		const toAvoid = _.compact([...room.sources, room.mineral]);
		const range = 4;
		_.forEach(toAvoid, (center: RoomObject) => {
			for (let dx = -range; dx <= range; dx++) {
				for (let dy = -range; dy <= range; dy++) {
					matrix.set(center.pos.x + dx, center.pos.y + dy, 0xff);
				}
			}
		});
		room._skMatrix = matrix;
		return room._skMatrix;
	}

	/* Find a viable sequence of rooms to narrow down Pathfinder algorithm */
	static findRoute(origin: string, destination: string,
					 options: MoveOptions = {}): { [roomName: string]: boolean } | undefined {
		let restrictDistance = options.restrictDistance || Game.map.getRoomLinearDistance(origin, destination) + 10;
		let allowedRooms = {[origin]: true, [destination]: true};
		let highwayBias = options.preferHighway ? 2.5 : 1;

		let ret = Game.map.findRoute(origin, destination, {
			routeCallback: (roomName: string) => {
				let rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
				if (rangeToRoom > restrictDistance) { // room is too far out of the way
					return Number.POSITIVE_INFINITY;
				}
				if (!options.allowHostile && this.shouldAvoid(roomName) &&
					roomName !== destination && roomName !== origin) { // room is marked as "avoid" in room memory
					return Number.POSITIVE_INFINITY;
				}

				let parsed;
				if (options.preferHighway && WorldMap.roomType(roomName) == ROOMTYPE_ALLEY) {
					return 1;
				}

				return highwayBias;
			},
		});

		if (!_.isArray(ret)) {
			log.warning(`Movement: couldn't findRoute from ${origin} to ${destination}!`);
		} else {
			for (let value of ret) {
				allowedRooms[value.room] = true;
			}
			return allowedRooms;
		}
	}

	/* Serialize a path as a string of move directions */
	static serializePath(startPos: RoomPosition, path: RoomPosition[], color = 'orange'): string {
		let serializedPath = '';
		let lastPosition = startPos;
		for (let position of path) {
			if (position.roomName == lastPosition.roomName) {
				new RoomVisual(position.roomName)
					.line(position, lastPosition, {color: color, lineStyle: 'dashed'});
				serializedPath += lastPosition.getDirectionTo(position);
			}
			lastPosition = position;
		}
		return serializedPath;
	}

	static nextDirectionInPath(creep: Zerg): number | undefined {
		let moveData = creep.memory._go as MoveData;
		if (!moveData || !moveData.path || moveData.path.length == 0) {
			return;
		}
		return Number.parseInt(moveData.path[0]);
	}

	static nextPositionInPath(creep: Zerg): RoomPosition | undefined {
		let nextDir = this.nextDirectionInPath(creep);
		if (!nextDir) {
			return;
		}
		return this.positionAtDirection(creep.pos, nextDir);
	}

	/* Returns a position at a direction from origin */
	static positionAtDirection(origin: RoomPosition, direction: number): RoomPosition | undefined {
		let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
		let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
		let x = origin.x + offsetX[direction];
		let y = origin.y + offsetY[direction];
		if (x > 49 || x < 0 || y > 49 || y < 0) {
			return;
		}
		return new RoomPosition(x, y, origin.roomName);
	}

	static savePath(path: RoomPosition[]): void {
		let savedPath: CachedPath = {
			path  : path,
			length: path.length,
			tick  : Game.time
		};
		let originName = _.first(path).name;
		let destinationName = _.last(path).name;
		if (!Memory.pathing.paths[originName]) {
			Memory.pathing.paths[originName] = {};
		}
		Memory.pathing.paths[originName][destinationName] = savedPath;
	}

	// Distance and path weight calculations ===========================================================================

	/* Calculate and/or cache the length of the shortest path between two points.
	 * Cache is probabilistically cleared in Mem */
	static distance(arg1: RoomPosition, arg2: RoomPosition): number {
		let [name1, name2] = [arg1.name, arg2.name].sort(); // alphabetize since path is the same in either direction
		if (!Memory.pathing.distances[name1]) {
			Memory.pathing.distances[name1] = {};
		}
		if (!Memory.pathing.distances[name1][name2]) {
			let ret = this.findShortestPath(arg1, arg2);
			if (!ret.incomplete) {
				Memory.pathing.distances[name1][name2] = ret.path.length;
			}
		}
		return Memory.pathing.distances[name1][name2];
	}

	static calculatePathWeight(startPos: RoomPosition, endPos: RoomPosition, options: MoveOptions = {}): number {
		_.defaults(options, {
			range  : 1,
			allowSK: true,
		});
		let ret = this.findPath(startPos, endPos, options);
		let weight = 0;
		for (let pos of ret.path) {
			if (!pos.room) { // If you don't have vision, assume there are roads
				weight += 1;
			} else {
				if (pos.lookForStructure(STRUCTURE_ROAD)) {
					weight += 1;
				} else {
					let terrain = pos.lookFor(LOOK_TERRAIN)[0];
					if (terrain == 'plain') {
						weight += 2;
					} else if (terrain == 'swamp') {
						weight += 10;
					}
				}
			}
		}
		return weight;
	}

	/* Calculates and/or caches the weighted distance for the most efficient path. Weight is sum of tile weights:
	 * Road = 1, Plain = 2, Swamp = 10. Cached weights are cleared in Mem occasionally. */
	static weightedDistance(arg1: RoomPosition, arg2: RoomPosition): number {
		let pos1, pos2: RoomPosition;
		if (arg1.name < arg2.name) { // alphabetize since path lengths are the same either direction
			pos1 = arg1;
			pos2 = arg2;
		} else {
			pos1 = arg2;
			pos2 = arg1;
		}
		if (!Memory.pathing.weightedDistances[pos1.name]) {
			Memory.pathing.weightedDistances[pos1.name] = {};
		}
		if (!Memory.pathing.weightedDistances[pos1.name][pos2.name]) {
			Memory.pathing.weightedDistances[pos1.name][pos2.name] = this.calculatePathWeight(pos1, pos2);
		}
		return Memory.pathing.weightedDistances[pos1.name][pos2.name];
	}

	/* Returns the shortest path from start to end position, regardless of (passable) terrain */
	static findShortestPath(startPos: RoomPosition, endPos: RoomPosition,
							options: MoveOptions = {}): PathFinderPath {
		_.defaults(options, {
			ignoreCreeps: true,
			range       : 1,
			offRoad     : true,
			allowSK     : true,
		});
		let ret = this.findPath(startPos, endPos, options);
		if (ret.incomplete) log.alert(`Pathing: incomplete path from ${startPos.print} to ${endPos.print}!`);
		return ret;
	}

	/* Whether another object in the same room can be reached from the current position */
	static isReachable(startPos: RoomPosition, endPos: RoomPosition, options: MoveOptions = {}): boolean {
		_.defaults(options, {
			ignoreCreeps: false,
			range       : 1,
			offRoad     : true,
			allowSK     : true,
			allowHostile: true,
			maxRooms    : 1,
			maxOps      : 2000,
			ensurePath  : false
		});
		let ret = this.findPath(startPos, endPos, options);
		return !(ret.incomplete);
	}

	// /* Find the shortest path, preferentially stepping on tiles with road routing flags */
	// static routeRoadPath(origin: RoomPosition, destination: RoomPosition,
	// 					 options: TravelToOptions = {}): PathfinderReturn {
	// 	_.defaults(options, {
	// 		ignoreCreeps: true,
	// 		range       : 1,
	// 		offRoad     : true,
	// 		allowSK     : true,
	// 	});
	// 	let originRoomName = origin.roomName;
	// 	let destRoomName = destination.roomName;
	//
	// 	let roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
	// 	let allowedRooms = options.route;
	// 	if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && roomDistance > 2))) {
	// 		let route = this.findRoute(origin.roomName, destination.roomName, options);
	// 		if (route) {
	// 			allowedRooms = route;
	// 		}
	// 	}
	//
	// 	let callback = (roomName: string) => this.roomCallback(roomName, origin, destination, allowedRooms, options);
	//
	// 	let callback = (roomName: string): CostMatrix | boolean => {
	// 		if (allowedRooms) {
	// 			if (!allowedRooms[roomName]) {
	// 				return false;
	// 			}
	// 		} else if (!options.allowHostile && this.shouldAvoid(roomName)
	// 				   && roomName !== destRoomName && roomName !== originRoomName) {
	// 			return false;
	// 		}
	//
	// 		let matrix;
	// 		let room = Game.rooms[roomName];
	// 		if (room) {
	// 			matrix = Traveler.getStructureMatrix(room, options.freshMatrix);
	// 			if (options.obstacles) {
	// 				matrix = matrix.clone();
	// 				for (let obstacle of options.obstacles) {
	// 					if (obstacle.roomName !== roomName) {
	// 						continue;
	// 					}
	// 					matrix.set(obstacle.x, obstacle.y, 0xff);
	// 				}
	// 			}
	// 			// Prefer pathing through flags
	// 			let pathingFlags = _.filter(room.flags, flag => flag.color == COLOR_WHITE &&
	// 															flag.secondaryColor == COLOR_WHITE);
	// 			for (let flag of pathingFlags) {
	// 				matrix.set(flag.pos.x, flag.pos.y, 0x01);
	// 			}
	// 		}
	// 		return matrix as CostMatrix;
	// 	};
	//
	// 	return PathFinder.search(origin, {pos: destination, range: options.range!}, {
	// 		maxOps      : options.maxOps,
	// 		maxRooms    : options.maxRooms,
	// 		plainCost   : 2,
	// 		swampCost   : 2,
	// 		roomCallback: callback,
	// 	});
	// }
}

