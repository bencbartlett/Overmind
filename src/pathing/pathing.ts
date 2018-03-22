import {Traveler} from '../lib/traveler/Traveler';
import {log} from '../lib/logger/log';
import profiler from 'screeps-profiler';

/* Module for pathing-related operations. Interfaces with Traveler. */
export class Pathing {
	// static serializePath(startPos: RoomPosition, path: RoomPosition[]): string {
	// 	let serializedPath = "";
	// 	let lastPosition = startPos;
	// 	for (let position of path) {
	// 		if (position.roomName == lastPosition.roomName) {
	// 			serializedPath += lastPosition.getDirectionTo(position);
	// 		}
	// 		lastPosition = position;
	// 	}
	// 	return serializedPath;
	// }

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

	/* Calculate and/or cache the length of the shortest path between two points.
	 * Cache is probabilistically cleared in Mem */
	static distance(arg1: RoomPosition, arg2: RoomPosition): number {
		let pos1, pos2: RoomPosition;
		if (arg1.name < arg2.name) { // alphabetize since path lengths are the same either direction
			pos1 = arg1;
			pos2 = arg2;
		} else {
			pos1 = arg2;
			pos2 = arg1;
		}
		if (!Memory.pathing.distances[pos1.name]) {
			Memory.pathing.distances[pos1.name] = {};
		}
		if (!Memory.pathing.distances[pos1.name][pos2.name]) {
			let ret = this.findShortestPath(pos1, pos2);
			if (!ret.incomplete) {
				Memory.pathing.distances[pos1.name][pos2.name] = ret.path.length;
			}
		}
		return Memory.pathing.distances[pos1.name][pos2.name];
	}

	static calculatePathWeight(startPos: RoomPosition, endPos: RoomPosition, options: TravelToOptions = {}): number {
		_.defaults(options, {
			range  : 1,
			allowSK: true,
		});
		let ret = Traveler.findTravelPath(startPos, endPos, options);
		let weight = 0;
		for (let pos of ret.path) {
			if (!Game.rooms[pos.roomName]) { // If you don't have vision, assume there are roads
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
							options: TravelToOptions = {}): PathfinderReturn {
		_.defaults(options, {
			ignoreCreeps: true,
			range       : 1,
			offRoad     : true,
			allowSK     : true,
		});
		let ret = Traveler.findTravelPath(startPos, endPos, options);
		if (ret.incomplete) log.info(`Incomplete travel path from ${startPos} to ${endPos}!`);
		return ret;
	}

	/* Whether another object in the same room can be reached from the current position */
	static isReachable(startPos: RoomPosition, endPos: RoomPosition, options: TravelToOptions = {}): boolean {
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
		let ret = Traveler.findTravelPath(startPos, endPos, options);
		return !(ret.incomplete);
	}

	/* Returns the shortest path from start to end position */
	static findTravelPath(startPos: RoomPosition, endPos: RoomPosition,
						  options: TravelToOptions = {}): PathfinderReturn {
		_.defaults(options, {
			ignoreCreeps: true,
			range       : 1,
		});
		let ret = Traveler.findTravelPath(startPos, endPos, options);
		if (ret.incomplete) log.info(`Incomplete travel path from ${startPos} to ${endPos}!`);
		return ret;
	}

	/* Find the shortest path, preferentially stepping on tiles with road routing flags */
	static routeRoadPath(origin: RoomPosition, destination: RoomPosition,
						 options: TravelToOptions = {}): PathfinderReturn {
		_.defaults(options, {
			ignoreCreeps: true,
			range       : 1,
			offRoad     : true,
			allowSK     : true,
		});
		let originRoomName = origin.roomName;
		let destRoomName = destination.roomName;

		let roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
		let allowedRooms = options.route;
		if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && roomDistance > 2))) {
			let route = Traveler.findRoute(origin.roomName, destination.roomName, options);
			if (route) {
				allowedRooms = route;
			}
		}

		let callback = (roomName: string): CostMatrix | boolean => {
			if (allowedRooms) {
				if (!allowedRooms[roomName]) {
					return false;
				}
			} else if (!options.allowHostile && Traveler.checkAvoid(roomName)
					   && roomName !== destRoomName && roomName !== originRoomName) {
				return false;
			}

			let matrix;
			let room = Game.rooms[roomName];
			if (room) {
				matrix = Traveler.getStructureMatrix(room, options.freshMatrix);
				if (options.obstacles) {
					matrix = matrix.clone();
					for (let obstacle of options.obstacles) {
						if (obstacle.roomName !== roomName) {
							continue;
						}
						matrix.set(obstacle.x, obstacle.y, 0xff);
					}
				}
				// Prefer pathing through flags
				let pathingFlags = _.filter(room.flags, flag => flag.color == COLOR_WHITE &&
																flag.secondaryColor == COLOR_WHITE);
				for (let flag of pathingFlags) {
					matrix.set(flag.pos.x, flag.pos.y, 0x01);
				}
			}
			return matrix as CostMatrix;
		};

		return PathFinder.search(origin, {pos: destination, range: options.range!}, {
			maxOps      : options.maxOps,
			maxRooms    : options.maxRooms,
			plainCost   : 2,
			swampCost   : 2,
			roomCallback: callback,
		});
	}
}

profiler.registerClass(Pathing, 'Pathing');

