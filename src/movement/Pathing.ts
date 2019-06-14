import {$} from '../caching/GlobalCache';
import {log} from '../console/log';
import {hasPos} from '../declarations/typeGuards';
import {profile} from '../profiler/decorator';
import {Cartographer, ROOMTYPE_ALLEY, ROOMTYPE_SOURCEKEEPER} from '../utilities/Cartographer';
import {Visualizer} from '../visuals/Visualizer';
import {Zerg} from '../zerg/Zerg';
import {normalizePos} from './helpers';
import {MoveOptions, SwarmMoveOptions} from './Movement';


const DEFAULT_MAXOPS = 20000;		// Default timeout for pathfinding
const CREEP_COST = 0xfe;

export interface TerrainCosts {
	plainCost: number;
	swampCost: number;
}

export const MatrixTypes = {
	direct       : 'dir',
	default      : 'def',
	sk           : 'sk',
	obstacle     : 'obst',
	preferRampart: 'preframp'
};

/**
 * Module for pathing-related operations.
 */
@profile
export class Pathing {

	// Room avoidance methods ==========================================================================================

	/**
	 * Check if the room should be avoiding when calculating routes
	 */
	static shouldAvoid(roomName: string) {
		return Memory.rooms[roomName] && Memory.rooms[roomName][_RM.AVOID];
	}

	/**
	 * Update memory on whether a room should be avoided based on controller owner
	 */
	static updateRoomStatus(room: Room) {
		if (!room) {
			return;
		}
		if (room.controller) {
			if (room.controller.owner && !room.controller.my && room.towers.length > 0) {
				room.memory[_RM.AVOID] = true;
			} else {
				delete room.memory[_RM.AVOID];
				// if (room.memory.expansionData == false) delete room.memory.expansionData;
			}
		}
	}

	// Pathfinding and room callback methods ===========================================================================

	/**
	 * Find a path from origin to destination
	 */
	static findPath(origin: RoomPosition, destination: RoomPosition, options: MoveOptions = {}): PathFinderPath {
		_.defaults(options, {
			ignoreCreeps: true,
			maxOps      : DEFAULT_MAXOPS,
			range       : 1,
			terrainCosts: {plainCost: 1, swampCost: 5},
		});

		if (options.movingTarget) {
			options.range = 0;
		}

		// check to see whether findRoute should be used
		const roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
		let allowedRooms = options.route;
		if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && roomDistance > 2))) {
			allowedRooms = this.findRoute(origin.roomName, destination.roomName, options);
		}

		if (options.direct) {
			options.terrainCosts = {plainCost: 1, swampCost: 1};
		}

		const callback = (roomName: string) => this.roomCallback(roomName, origin, destination, allowedRooms, options);
		let ret = PathFinder.search(origin, {pos: destination, range: options.range!}, {
			maxOps      : options.maxOps,
			maxRooms    : options.maxRooms,
			plainCost   : options.terrainCosts!.plainCost,
			swampCost   : options.terrainCosts!.swampCost,
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

	/**
	 * Find a path from origin to destination
	 */
	static findSwarmPath(origin: RoomPosition, destination: RoomPosition, width: number, height: number,
						 options: SwarmMoveOptions = {}): PathFinderPath {
		_.defaults(options, {
			ignoreCreeps: true,
			maxOps      : 2 * DEFAULT_MAXOPS,
			range       : 1,
		});
		// Make copies of the destination offset for where anchor could be
		const destinations = this.getPosWindow(destination, -width, -height);
		const callback = (roomName: string) => this.swarmRoomCallback(roomName, width, height, options);
		return PathFinder.search(origin, _.map(destinations, pos => ({pos: pos, range: options.range!})), {
			maxOps      : options.maxOps,
			maxRooms    : options.maxRooms,
			plainCost   : 1,
			swampCost   : 5,
			roomCallback: callback,
		});
	}

	/**
	 * Get a window of offset RoomPositions from an anchor position and a window width and height
	 */
	static getPosWindow(anchor: RoomPosition, width: number, height: number): RoomPosition[] {
		const positions: RoomPosition[] = [];
		for (const dx of _.range(0, width, width < 0 ? -1 : 1)) {
			for (const dy of _.range(0, height, height < 0 ? -1 : 1)) {
				positions.push(anchor.getOffsetPos(dx, dy));
			}
		}
		return positions;
	}

	/**
	 * Returns the shortest path from start to end position, regardless of (passable) terrain
	 */
	static findShortestPath(startPos: RoomPosition, endPos: RoomPosition,
							options: MoveOptions = {}): PathFinderPath {
		_.defaults(options, {
			ignoreCreeps: true,
			range       : 1,
			direct      : true,
		});
		const ret = this.findPath(startPos, endPos, options);
		if (ret.incomplete) log.alert(`Pathing: incomplete path from ${startPos.print} to ${endPos.print}!`);
		return ret;
	}

	/**
	 * Returns the shortest path from start to end position, regardless of (passable) terrain
	 */
	static findPathToRoom(startPos: RoomPosition, roomName: string, options: MoveOptions = {}): PathFinderPath {
		options.range = 23;
		const ret = this.findPath(startPos, new RoomPosition(25, 25, roomName), options);
		if (ret.incomplete) log.alert(`Pathing: incomplete path from ${startPos.print} to ${roomName}!`);
		return ret;
	}

	/**
	 * Default room callback, which automatically determines the most appropriate callback method to use
	 */
	static roomCallback(roomName: string, origin: RoomPosition, destination: RoomPosition,
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
			const matrix = this.getCostMatrix(room, options, false);
			// Modify cost matrix if needed
			if (options.modifyRoomCallback) {
				return options.modifyRoomCallback(room, matrix.clone());
			} else {
				return matrix;
			}
		} else { // have no vision
			return this.getCostMatrixForInvisibleRoom(roomName, options);
		}
	}

	static swarmRoomCallback(roomName: string, width: number, height: number,
							 options: SwarmMoveOptions): CostMatrix | boolean {
		const room = Game.rooms[roomName];
		let matrix: CostMatrix;
		if (room && !options.ignoreStructures) {
			matrix = this.getSwarmDefaultMatrix(room, width, height, options, false);
		} else {
			matrix = this.getSwarmTerrainMatrix(roomName, width, height, options.exitCost);
		}
		if (options.displayCostMatrix) {
			Visualizer.displayCostMatrix(matrix, roomName);
		}
		return matrix;
	}

	private static kitingRoomCallback(roomName: string): CostMatrix | boolean {
		const room = Game.rooms[roomName];
		if (room) {
			return Pathing.getKitingMatrix(room);
		} else { // have no vision
			return true;
		}
	}

	/**
	 * Get a kiting path within a room
	 */
	static findKitingPath(creepPos: RoomPosition, fleeFrom: (RoomPosition | HasPos)[],
						  options: MoveOptions = {}): PathFinderPath {
		_.defaults(options, {
			fleeRange   : 5,
			terrainCosts: {plainCost: 1, swampCost: 5},
		});
		const fleeFromPos = _.map(fleeFrom, flee => normalizePos(flee));
		const avoidGoals = _.map(fleeFromPos, pos => {
			return {pos: pos, range: options.fleeRange!};
		});
		return PathFinder.search(creepPos, avoidGoals,
								 {
									 plainCost   : options.terrainCosts!.plainCost,
									 swampCost   : options.terrainCosts!.swampCost,
									 flee        : true,
									 roomCallback: Pathing.kitingRoomCallback,
									 maxRooms    : 1
								 });
	}

	/**
	 * Get a flee path possibly leaving the room; generally called further in advance of kitingPath
	 */
	static findFleePath(creepPos: RoomPosition, fleeFrom: (RoomPosition | HasPos)[],
						options: MoveOptions = {}): PathFinderPath {
		_.defaults(options, {
			terrainCosts: {plainCost: 1, swampCost: 5},
		});
		if (options.fleeRange == undefined) options.fleeRange = options.terrainCosts!.plainCost > 1 ? 20 : 10;
		const fleeFromPos = _.map(fleeFrom, flee => normalizePos(flee));
		const avoidGoals = _.map(fleeFromPos, pos => {
			return {pos: pos, range: options.fleeRange!};
		});
		const callback = (roomName: string) => {
			if (!options.allowHostile && this.shouldAvoid(roomName) && roomName != creepPos.roomName) {
				return false;
			}
			const room = Game.rooms[roomName];
			if (room) {
				const matrix = this.getCostMatrix(room, options, false);
				// Modify cost matrix if needed
				if (options.modifyRoomCallback) {
					return options.modifyRoomCallback(room, matrix.clone());
				} else {
					return matrix;
				}
			} else { // have no vision
				return true;
			}
		};
		return PathFinder.search(creepPos, avoidGoals,
								 {
									 plainCost   : options.terrainCosts!.plainCost,
									 swampCost   : options.terrainCosts!.swampCost,
									 flee        : true,
									 roomCallback: callback,
								 });
	}

	// Cost matrix retrieval functions =================================================================================

	/**
	 * Get a cloned copy of the cost matrix for a room with specified options
	 */
	static getCostMatrix(room: Room, options: MoveOptions, clone = true): CostMatrix {
		let matrix: CostMatrix;
		if (options.ignoreCreeps == false) {
			matrix = this.getCreepMatrix(room);
		} else if (options.avoidSK) {
			matrix = this.getSkMatrix(room);
		} else if (options.ignoreStructures) {
			matrix = new PathFinder.CostMatrix();
		} else if (options.direct) {
			matrix = this.getDirectMatrix(room);
		} else {
			matrix = this.getDefaultMatrix(room);
		}
		// Register other obstacles
		if (options.obstacles && options.obstacles.length > 0) {
			matrix = matrix.clone();
			for (const obstacle of options.obstacles) {
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

	static getSwarmDefaultMatrix(room: Room, width: number, height: number,
								 options: SwarmMoveOptions = {}, clone = true): CostMatrix {
		let matrix = $.costMatrix(room.name, `swarm${width}x${height}`, () => {
			const mat = this.getTerrainMatrix(room.name).clone();
			this.blockImpassibleStructures(mat, room);
			this.setExitCosts(mat, room.name, options.exitCost || 10);
			this.applyMovingMaximum(mat, width, height);
			return mat;
		}, 25);
		if (options.ignoreCreeps == false) {
			matrix = matrix.clone();
			this.blockHostileCreeps(matrix, room); // todo: need to smear again?
		}
		if (clone) {
			matrix = matrix.clone();
		}
		return matrix;
	}

	private static getCostMatrixForInvisibleRoom(roomName: string, options: MoveOptions,
												 clone = true): CostMatrix | boolean {
		let matrix: CostMatrix | undefined;
		if (options.avoidSK) {
			matrix = $.costMatrixRecall(roomName, MatrixTypes.sk);
		} else if (options.direct) {
			matrix = $.costMatrixRecall(roomName, MatrixTypes.direct);
		} else {
			matrix = $.costMatrixRecall(roomName, MatrixTypes.default);
		}
		// Register other obstacles
		if (matrix && options.obstacles && options.obstacles.length > 0) {
			matrix = matrix.clone();
			for (const obstacle of options.obstacles) {
				if (obstacle && obstacle.roomName == roomName) {
					matrix.set(obstacle.x, obstacle.y, 0xff);
				}
			}
		}
		if (matrix && clone) {
			matrix = matrix.clone();
		}
		return matrix || true;
	}

	// Cost matrix generation functions ================================================================================

	/**
	 * Get a matrix of explicit terrain values for a room
	 */
	static getTerrainMatrix(roomName: string, costs: TerrainCosts = {plainCost: 1, swampCost: 5}): CostMatrix {
		return $.costMatrix(roomName, `terrain:${costs.plainCost}:${costs.swampCost}`, () => {
			const matrix = new PathFinder.CostMatrix();
			const terrain = Game.map.getRoomTerrain(roomName);
			for (let y = 0; y < 50; ++y) {
				for (let x = 0; x < 50; ++x) {
					switch (terrain.get(x, y)) {
						case TERRAIN_MASK_SWAMP:
							matrix.set(x, y, costs.swampCost);
							break;
						case TERRAIN_MASK_WALL:
							matrix.set(x, y, 0xff);
							break;
						default: // plain
							matrix.set(x, y, costs.plainCost);
							break;
					}
				}
			}
			return matrix;
		}, 10000);
	}

	/**
	 * Get a cloned copy of the cost matrix for a room with specified options
	 */
	static getSwarmTerrainMatrix(roomName: string, width: number, height: number, exitCost = 10): CostMatrix {
		const matrix = $.costMatrix(roomName, `swarmTerrain${width}x${height}EC${exitCost}`, () => {
			const mat = this.getTerrainMatrix(roomName).clone();
			this.setExitCosts(mat, roomName, exitCost);
			this.applyMovingMaximum(mat, width, height);
			return mat;
		}, 10000);
		return matrix;
	}

	/**
	 * Default matrix for a room, setting impassable structures and constructionSites to impassible
	 */
	static getDefaultMatrix(room: Room): CostMatrix {
		return $.costMatrix(room.name, MatrixTypes.default, () => {
			const matrix = new PathFinder.CostMatrix();
			// Set passability of structure positions
			const impassibleStructures: Structure[] = [];
			_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
				if (s.structureType == STRUCTURE_ROAD) {
					matrix.set(s.pos.x, s.pos.y, 1);
				} else if (!s.isWalkable) {
					impassibleStructures.push(s);
				}
			});
			_.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
			const portals = _.filter(impassibleStructures, s => s.structureType == STRUCTURE_PORTAL);
			_.forEach(portals, p => matrix.set(p.pos.x, p.pos.y, 0xfe));
			// Set passability of construction sites
			_.forEach(room.find(FIND_CONSTRUCTION_SITES), (site: ConstructionSite) => {
				if (site.my && !site.isWalkable) {
					matrix.set(site.pos.x, site.pos.y, 0xff);
				}
			});
			return matrix;
		});
	}


	/**
	 * Default matrix for a room, setting impassable structures and constructionSites to impassible, ignoring roads
	 */
	static getDirectMatrix(room: Room): CostMatrix {
		return $.costMatrix(room.name, MatrixTypes.direct, () => {
			const matrix = new PathFinder.CostMatrix();
			// Set passability of structure positions
			const impassibleStructures: Structure[] = [];
			_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
				if (!s.isWalkable) {
					impassibleStructures.push(s);
				}
			});
			_.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
			const portals = _.filter(impassibleStructures, s => s.structureType == STRUCTURE_PORTAL);
			_.forEach(portals, p => matrix.set(p.pos.x, p.pos.y, 0xfe));
			// Set passability of construction sites
			_.forEach(room.find(FIND_MY_CONSTRUCTION_SITES), (site: ConstructionSite) => {
				if (!site.isWalkable) {
					matrix.set(site.pos.x, site.pos.y, 0xff);
				}
			});
			return matrix;
		});
	}

	/**
	 * Avoids creeps in a room
	 */
	static getCreepMatrix(room: Room, fromMatrix?: CostMatrix): CostMatrix {
		if (room._creepMatrix) {
			return room._creepMatrix;
		}
		const matrix = this.getDefaultMatrix(room).clone();
		_.forEach(room.find(FIND_CREEPS), c => matrix.set(c.pos.x, c.pos.y, CREEP_COST)); // don't block off entirely
		room._creepMatrix = matrix;
		return room._creepMatrix;
	}

	/**
	 * Kites around hostile creeps in a room
	 */
	static getKitingMatrix(room: Room): CostMatrix {
		if (room._kitingMatrix) {
			return room._kitingMatrix;
		}
		const matrix = this.getCreepMatrix(room).clone();
		const avoidCreeps = _.filter(room.hostiles,
									 c => c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0);
		// || c.getActiveBodyparts(HEAL) > 0);
		_.forEach(avoidCreeps, avoidCreep => {
			let cost: number;
			for (let dx = -3; dx <= 3; dx++) {
				for (let dy = -3; dy <= 3; dy++) {
					cost = matrix.get(avoidCreep.pos.x + dx, avoidCreep.pos.y + dy);
					cost += 40 - (10 * Math.max(Math.abs(dx), Math.abs(dy)));
					matrix.set(avoidCreep.pos.x + dx, avoidCreep.pos.y + dy, cost);
				}
			}
		});
		room._kitingMatrix = matrix;
		return room._kitingMatrix;
	}

	/**
	 * Avoids source keepers in a room
	 */
	private static getSkMatrix(room: Room): CostMatrix {
		if (Cartographer.roomType(room.name) != ROOMTYPE_SOURCEKEEPER) {
			return this.getDefaultMatrix(room);
		}
		return $.costMatrix(room.name, MatrixTypes.sk, () => {
			const matrix = this.getDefaultMatrix(room).clone();
			const avoidRange = 6;
			_.forEach(room.keeperLairs, lair => {
				for (let dx = -avoidRange; dx <= avoidRange; dx++) {
					for (let dy = -avoidRange; dy <= avoidRange; dy++) {
						matrix.set(lair.pos.x + dx, lair.pos.y + dy, 0xfe);
					}
				}
			});
			return matrix;
		});
	}

	// /* Avoids source keepers in a room */
	// private static getInvisibleSkMatrix(roomName: string): CostMatrix {
	// 	let matrix = new PathFinder.CostMatrix();
	// 	if (Cartographer.roomType(roomName) == ROOMTYPE_SOURCEKEEPER) {
	// 		if (Memory.rooms[roomName] && Memory.rooms[roomName].SKlairs != undefined) {
	//
	// 			const avoidRange = 5;
	// 			const lairs: RoomPosition[] = _.map(Memory.rooms[roomName].SKlairs!,
	// 												saved => derefCoords(saved.c, roomName));
	// 			_.forEach(lairs, lair => {
	// 				for (let dx = -avoidRange; dx <= avoidRange; dx++) {
	// 					for (let dy = -avoidRange; dy <= avoidRange; dy++) {
	// 						matrix.set(lair.x + dx, lair.y + dy, 0xff);
	// 					}
	// 				}
	// 			});
	// 		}
	// 	}
	// 	return matrix;
	// }

	// In-place CostMatrix manipulation routines =======================================================================

	/**
	 * Sets impassible structure positions to 0xff
	 */
	static blockImpassibleStructures(matrix: CostMatrix, room: Room) {
		_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
			if (!s.isWalkable) {
				if (s.structureType == STRUCTURE_PORTAL) {
					matrix.set(s.pos.x, s.pos.y, 0xfe);
				} else {
					matrix.set(s.pos.x, s.pos.y, 0xff);
				}
			}
		});
	}

	/**
	 * Sets all creep positions to impassible
	 */
	static blockMyCreeps(matrix: CostMatrix, room: Room, creeps?: (Creep | Zerg)[]) {

		const blockCreeps = creeps || room.creeps as (Creep | Zerg)[];
		const blockPositions = _.map(blockCreeps,
									 creep => Overmind.zerg[creep.name] ? Overmind.zerg[creep.name].nextPos
																		: creep.pos);

		_.forEach(blockPositions, pos => {
			matrix.set(pos.x, pos.y, CREEP_COST);
		});
	}

	/**
	 * Sets hostile creep positions to impassible
	 */
	static blockHostileCreeps(matrix: CostMatrix, room: Room) {
		_.forEach(room.hostiles, hostile => {
			matrix.set(hostile.pos.x, hostile.pos.y, CREEP_COST);
		});
	}

	/**
	 * Sets all creep positions to impassible
	 */
	static blockAllCreeps(matrix: CostMatrix, room: Room) {
		_.forEach(room.find(FIND_CREEPS), creep => {
			matrix.set(creep.pos.x, creep.pos.y, CREEP_COST);
		});
	}

	/**
	 * Sets road positions to 1 if cost is less than 0xfe
	 */
	static preferRoads(matrix: CostMatrix, room: Room) {
		_.forEach(room.roads, road => {
			if (matrix.get(road.pos.x, road.pos.y) < 0xfe) {
				matrix.set(road.pos.x, road.pos.y, 1);
			}
		});
	}

	/**
	 * Sets walkable rampart positions to 1 if cost is less than 0xfe
	 */
	static preferRamparts(matrix: CostMatrix, room: Room) {
		_.forEach(room.walkableRamparts, rampart => {
			if (matrix.get(rampart.pos.x, rampart.pos.y) < 0xfe) {
				matrix.set(rampart.pos.x, rampart.pos.y, 1);
			}
		});
	}

	/**
	 * Sets walkable rampart positions to 1, everything else is blocked
	 */
	static blockNonRamparts(matrix: CostMatrix, room: Room) {
		for (let y = 0; y < 50; ++y) {
			for (let x = 0; x < 50; ++x) {
				matrix.set(x, y, 0xff);
			}
		}
		_.forEach(room.walkableRamparts, rampart => {
			matrix.set(rampart.pos.x, rampart.pos.y, 1);
		});
	}

	/**
	 * Explicitly blocks off walls for a room
	 */
	static blockImpassibleTerrain(matrix: CostMatrix, roomName: string) {
		const terrain = Game.map.getRoomTerrain(roomName);
		for (let y = 0; y < 50; ++y) {
			for (let x = 0; x < 50; ++x) {
				if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
					matrix.set(x, y, 0xff);
				}
			}
		}
	}

	/**
	 * Transform a CostMatrix such that the cost at each point is transformed to the max of costs in a width x height
	 * window (indexed from upper left corner). This requires that terrain be explicitly specified in the matrix!
	 */
	static applyMovingMaximum(matrix: CostMatrix, width: number, height: number) {
		// Since we're moving in increasing order of x, y, we don't need to clone the matrix
		let x, y, dx, dy: number;
		let maxCost, cost: number;
		for (x = 0; x <= 50 - width; x++) {
			for (y = 0; y <= 50 - height; y++) {
				maxCost = matrix.get(x, y);
				for (dx = 0; dx <= width - 1; dx++) {
					for (dy = 0; dy <= height - 1; dy++) {
						cost = matrix.get(x + dx, y + dy);
						if (cost > maxCost) {
							maxCost = cost;
						}
					}
				}
				matrix.set(x, y, maxCost);
			}
		}
	}

	static setCostsInRange(matrix: CostMatrix, pos: RoomPosition | HasPos, range: number, cost = 30, add = false) {
		pos = normalizePos(pos);
		const terrain = Game.map.getRoomTerrain(pos.roomName);

		for (let dx = -range; dx <= range; dx++) {
			const x = pos.x + dx;
			if (x < 0 || x > 49) continue;
			for (let dy = -range; dy <= range; dy++) {
				const y = pos.y + dy;
				if (y < 0 || y > 49) continue;
				const posTerrain = terrain.get(x, y);
				if (posTerrain === TERRAIN_MASK_WALL) {
					continue;
				}
				let currentCost = matrix.get(x, y);
				if (currentCost === 0) {
					if (posTerrain === TERRAIN_MASK_SWAMP) {
						currentCost += 10;
					} else {
						currentCost += 2;
					}
				}
				if (currentCost >= 0xff || currentCost > cost) continue;
				matrix.set(x, y, add ? Math.min(cost + currentCost, 200) : cost);
			}
		}
	}

	static blockExits(matrix: CostMatrix, rangeToEdge = 0) {
		for (let x = rangeToEdge; x < 50 - rangeToEdge; x += 49 - rangeToEdge * 2) {
			for (let y = rangeToEdge; y < 50 - rangeToEdge; y++) {
				matrix.set(x, y, 0xff);
			}
		}
		for (let x = rangeToEdge; x < 50 - rangeToEdge; x++) {
			for (let y = rangeToEdge; y < 50 - rangeToEdge; y += 49 - rangeToEdge * 2) {
				matrix.set(x, y, 0xff);
			}
		}
	}

	static setExitCosts(matrix: CostMatrix, roomName: string, cost: number, rangeToEdge = 0) {
		const terrain = Game.map.getRoomTerrain(roomName);

		for (let x = rangeToEdge; x < 50 - rangeToEdge; x += 49 - rangeToEdge * 2) {
			for (let y = rangeToEdge; y < 50 - rangeToEdge; y++) {
				if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
					matrix.set(x, y, cost);
				}
			}
		}
		for (let x = rangeToEdge; x < 50 - rangeToEdge; x++) {
			for (let y = rangeToEdge; y < 50 - rangeToEdge; y += 49 - rangeToEdge * 2) {
				if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
					matrix.set(x, y, cost);
				}
			}
		}
	}

	static getExitPositions(roomName: string): RoomPosition[] {
		const terrain = Game.map.getRoomTerrain(roomName);
		const exitPositions: RoomPosition[] = [];

		for (let x = 0; x < 50; x += 49) {
			for (let y = 0; y < 50; y++) {
				if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
					exitPositions.push(new RoomPosition(x, y, roomName));
				}
			}
		}
		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y += 49) {
				if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
					exitPositions.push(new RoomPosition(x, y, roomName));
				}
			}
		}

		return exitPositions;
	}


	/**
	 * Find a viable sequence of rooms to narrow down Pathfinder algorithm
	 */
	static findRoute(origin: string, destination: string,
					 options: MoveOptions = {}): { [roomName: string]: boolean } | undefined {
		const linearDistance = Game.map.getRoomLinearDistance(origin, destination);
		const restrictDistance = options.restrictDistance || linearDistance + 10;
		const allowedRooms = {[origin]: true, [destination]: true};

		// Determine whether to use highway bias
		let highwayBias = 1;
		if (options.preferHighway) {
			highwayBias = 2.5;
		} else if (options.preferHighway != false) {
			// if (linearDistance > 8) {
			// 	highwayBias = 2.5;
			// } else {
			// 	let oCoords = Cartographer.getRoomCoordinates(origin);
			// 	let dCoords = Cartographer.getRoomCoordinates(destination);
			// 	if (_.any([oCoords.x, oCoords.y, dCoords.x, dCoords.y], z => z % 10 <= 1 || z % 10 >= 9)) {
			// 		highwayBias = 2.5;
			// 	}
			// }
		}

		const ret = (<GameMap>Game.map).findRoute(origin, destination, {
			routeCallback: (roomName: string) => {
				const rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
				if (rangeToRoom > restrictDistance) { // room is too far out of the way
					return Number.POSITIVE_INFINITY;
				}
				if (!options.allowHostile && this.shouldAvoid(roomName) &&
					roomName !== destination && roomName !== origin) { // room is marked as "avoid" in room memory
					return Number.POSITIVE_INFINITY;
				}
				if (options.preferHighway && Cartographer.roomType(roomName) == ROOMTYPE_ALLEY) {
					return 1;
				}
				return highwayBias;
			},
		});

		if (!_.isArray(ret)) {
			log.warning(`Movement: couldn't findRoute from ${origin} to ${destination}!`);
		} else {
			for (const value of ret) {
				allowedRooms[value.room] = true;
			}
			return allowedRooms;
		}
	}

	/**
	 * Serialize a path as a string of move directions
	 */
	static serializePath(startPos: RoomPosition, path: RoomPosition[], color = 'orange'): string {
		let serializedPath = '';
		let lastPosition = startPos;
		for (const position of path) {
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
		const moveData = creep.memory._go as MoveData;
		if (!moveData || !moveData.path || moveData.path.length == 0) {
			return;
		}
		return Number.parseInt(moveData.path[0], 10);
	}

	static nextPositionInPath(creep: Zerg): RoomPosition | undefined {
		const nextDir = this.nextDirectionInPath(creep);
		if (!nextDir) {
			return;
		}
		return this.positionAtDirection(creep.pos, nextDir);
	}

	static oppositeDirection(direction: DirectionConstant): DirectionConstant {
		switch (direction) {
			case TOP:
				return BOTTOM;
			case TOP_LEFT:
				return BOTTOM_RIGHT;
			case LEFT:
				return RIGHT;
			case BOTTOM_LEFT:
				return TOP_RIGHT;
			case BOTTOM:
				return TOP;
			case BOTTOM_RIGHT:
				return TOP_LEFT;
			case RIGHT:
				return LEFT;
			case TOP_RIGHT:
				return BOTTOM_LEFT;
		}
	}

	/**
	 * Returns a position at a direction from origin
	 */
	static positionAtDirection(origin: RoomPosition, direction: number): RoomPosition | undefined {
		const offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
		const offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
		const x = origin.x + offsetX[direction];
		const y = origin.y + offsetY[direction];
		if (x > 49 || x < 0 || y > 49 || y < 0) {
			return;
		}
		return new RoomPosition(x, y, origin.roomName);
	}

	static savePath(path: RoomPosition[]): void {
		const savedPath: CachedPath = {
			path  : path,
			length: path.length,
			tick  : Game.time
		};
		const originName = _.first(path).name;
		const destinationName = _.last(path).name;
		if (!Memory.pathing.paths[originName]) {
			Memory.pathing.paths[originName] = {};
		}
		Memory.pathing.paths[originName][destinationName] = savedPath;
	}

	// Distance and path weight calculations ===========================================================================

	/**
	 * Calculate and/or cache the length of the shortest path between two points.
	 * Cache is probabilistically cleared in Mem
	 */
	static distance(arg1: RoomPosition, arg2: RoomPosition): number {
		const [name1, name2] = [arg1.name, arg2.name].sort(); // alphabetize since path is the same in either direction
		if (!Memory.pathing.distances[name1]) {
			Memory.pathing.distances[name1] = {};
		}
		if (!Memory.pathing.distances[name1][name2]) {
			const ret = this.findShortestPath(arg1, arg2);
			if (!ret.incomplete) {
				Memory.pathing.distances[name1][name2] = ret.path.length;
			}
		}
		return Memory.pathing.distances[name1][name2];
	}

	static calculatePathWeight(startPos: RoomPosition, endPos: RoomPosition, options: MoveOptions = {}): number {
		_.defaults(options, {
			range: 1,
		});
		const ret = this.findPath(startPos, endPos, options);
		let weight = 0;
		for (const pos of ret.path) {
			if (!pos.room) { // If you don't have vision, assume there are roads
				weight += 1;
			} else {
				if (pos.lookForStructure(STRUCTURE_ROAD)) {
					weight += 1;
				} else {
					const terrain = pos.lookFor(LOOK_TERRAIN)[0];
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

	/**
	 * Calculates and/or caches the weighted distance for the most efficient path. Weight is sum of tile weights:
	 * Road = 1, Plain = 2, Swamp = 10. Cached weights are cleared in Mem occasionally.
	 */
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

	/**
	 * Whether another object in the same room can be reached from the current position
	 */
	static isReachable(startPos: RoomPosition, endPos: RoomPosition, obstacles: (RoomPosition | HasPos)[],
					   options: MoveOptions = {}): boolean {
		_.defaults(options, {
			ignoreCreeps: true,
			range       : 1,
			maxOps      : 2000,
			ensurePath  : false,
		});
		if (startPos.roomName != endPos.roomName) {
			log.error(`isReachable() should only be used within a single room!`);
			return false;
		}
		const matrix = new PathFinder.CostMatrix();
		_.forEach(obstacles, obstacle => {
			if (hasPos(obstacle)) {
				matrix.set(obstacle.pos.x, obstacle.pos.y, 0xfe);
			} else {
				matrix.set(obstacle.x, obstacle.y, 0xfe);
			}
		});
		const callback = (roomName: string) => roomName == endPos.roomName ? matrix : false;
		const ret = PathFinder.search(startPos, {pos: endPos, range: options.range!}, {
			maxOps      : options.maxOps,
			plainCost   : 1,
			swampCost   : 5,
			maxRooms    : 1,
			roomCallback: callback,
		});
		if (ret.incomplete) {
			return false;
		} else {
			for (const pos of ret.path) {
				if (matrix.get(pos.x, pos.y) > 100) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Like isReachable(), but returns the first position which should be cleared to find a path to destination
	 */
	static findBlockingPos(startPos: RoomPosition, endPos: RoomPosition, obstacles: (RoomPosition | HasPos)[],
						   options: MoveOptions = {}): RoomPosition | undefined {
		_.defaults(options, {
			ignoreCreeps: true,
			range       : 1,
			maxOps      : 2000,
			ensurePath  : false,
		});
		if (startPos.roomName != endPos.roomName) {
			log.error(`findBlockingPos() should only be used within a single room!`);
			return undefined;
		}
		const matrix = new PathFinder.CostMatrix();
		_.forEach(obstacles, obstacle => {
			if (hasPos(obstacle)) {
				matrix.set(obstacle.pos.x, obstacle.pos.y, 0xfe);
			} else {
				matrix.set(obstacle.x, obstacle.y, 0xfe);
			}
		});
		const callback = (roomName: string) => roomName == endPos.roomName ? matrix : false;
		const ret = PathFinder.search(startPos, {pos: endPos, range: options.range!}, {
			maxOps      : options.maxOps,
			plainCost   : 1,
			swampCost   : 5,
			maxRooms    : 1,
			roomCallback: callback,
		});
		for (const pos of ret.path) {
			if (matrix.get(pos.x, pos.y) > 100) {
				return pos;
			}
		}
	}

	/**
	 * Find the first walkable position in the room, spiraling outward from the center
	 */
	static findPathablePosition(roomName: string,
								clearance: { width: number, height: number } = {width: 1, height: 1}): RoomPosition {
		const terrain = Game.map.getRoomTerrain(roomName);

		let x, y: number;
		let allClear: boolean;
		for (let radius = 0; radius < 23; radius++) {
			for (let dx = -radius; dx <= radius; dx++) {
				for (let dy = -radius; dy <= radius; dy++) {
					if (Math.abs(dy) !== radius && Math.abs(dx) !== radius) {
						continue;
					}
					x = 25 + dx;
					y = 25 + dy;
					allClear = true;
					for (let w = 0; w < clearance.width; w++) {
						for (let h = 0; h < clearance.height; h++) {
							if (terrain.get(x + w, y + h) === TERRAIN_MASK_WALL) {
								allClear = false;
							}
						}
					}
					if (allClear) {
						return new RoomPosition(x, y, roomName);
					}
				}
			}
		}
		// Should never reach here!
		return new RoomPosition(-10, -10, 'cannotFindPathablePosition');
	}

}

// Register global instance
global.Pathing = Pathing;
