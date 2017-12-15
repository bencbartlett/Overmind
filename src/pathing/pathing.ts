import {Traveler} from '../lib/traveler/Traveler';

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

	static savePath(path: RoomPosition[]) {
		let savedPath: CachedPath = {
			path  : path,
			length: path.length,
			tick  : Game.time
		};
		if (!Memory.pathing) {
			Memory.pathing = {
				paths: {}
			};
		}

		let originName = _.first(path).name;
		let destinationName = _.last(path).name;

		if (!Memory.pathing.paths[originName]) {
			Memory.pathing.paths[originName] = {};
		}
		Memory.pathing.paths[originName][destinationName] = savedPath;
	}


	/* Returns the shortest path from start to end position, regardless of (passable) terrain */
	static findShortestPath(startPos: RoomPosition, endPos: RoomPosition, options: TravelToOptions = {}) {
		_.defaults(options, {
			range  : 1,
			offRoad: true,
			allowSK: true,

		});
		return Traveler.findTravelPath(startPos, endPos, options).path;
	}

	/* Find the shortest path, preferentially stepping on tiles with road routing flags */
	static routeRoadPath(origin: RoomPosition, destination: RoomPosition, options: TravelToOptions = {}) {
		_.defaults(options, {
			range  : 1,
			offRoad: true,
			allowSK: true,

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
				if (options.ignoreStructures) {
					matrix = new PathFinder.CostMatrix();
					if (!options.ignoreCreeps) {
						Traveler.addCreepsToMatrix(room, matrix);
					}
				} else if (options.ignoreCreeps || roomName !== originRoomName) {
					matrix = Traveler.getStructureMatrix(room, options.freshMatrix);
				} else {
					matrix = Traveler.getCreepMatrix(room);
				}
				if (options.obstacles) {
					matrix = matrix.clone();
					for (let obstacle of options.obstacles) {
						if (obstacle.pos.roomName !== roomName) {
							continue;
						}
						matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
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
		}).path;
	}
}


export var pathing = {
	findPathLengthIncludingRoads: function (startPos: RoomPosition, endPos: RoomPosition) {
		let ret = PathFinder.search(
			startPos, [{pos: endPos, range: 2}],
			[{
				plainCost   : 2,
				swampCost   : 10,
				roomCallback: function (roomName: string) {
					let room = Game.rooms[roomName];
					if (!room) return;
					let costs = new PathFinder.CostMatrix();

					room.find(FIND_STRUCTURES).forEach(function (structure: any) {
						if (structure.structureType === STRUCTURE_ROAD) {
							// Favor roads over plain tiles
							costs.set(structure.pos.x, structure.pos.y, 1);
						} else if (structure.structureType !== STRUCTURE_CONTAINER &&
								   (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
							// Can't walk through non-walkable buildings
							costs.set(structure.pos.x, structure.pos.y, 0xff);
						}
					});
					return costs;
				},
			}] as PathFinderOpts,
		);
		let path = ret.path;
		return path.length + 1; // offset for range
	},

	cachedPathLength: function (arg1: RoomPosition, arg2: RoomPosition) {
		let pos1, pos2: RoomPosition;
		if (arg1.name < arg2.name) { // alphabetize since path lengths are the same either direction
			pos1 = arg1;
			pos2 = arg2;
		} else {
			pos1 = arg2;
			pos2 = arg1;
		}
		if (!Memory.pathLengths) {
			Memory.pathLengths = {};
		}
		if (!Memory.pathLengths[pos1.name]) {
			Memory.pathLengths[pos1.name] = {};
		}
		if (!Memory.pathLengths[pos1.name][pos2.name]) {
			Memory.pathLengths[pos1.name][pos2.name] = this.findPathLengthIncludingRoads(pos1, pos2);
		}
		return Memory.pathLengths[pos1.name][pos2.name];
	},
};
