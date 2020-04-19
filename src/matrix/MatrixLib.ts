/* tslint:disable:no-bitwise prefer-for-of */

import {log} from '../console/log';
import {DirectiveSKOutpost} from '../directives/colony/outpostSK';
import {RoomIntel} from '../intel/RoomIntel';
import {normalizePos} from '../movement/helpers';
import {TerrainCosts} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../utilities/Cartographer';
import {unpackPosList} from '../utilities/packrat';
import {color, isAlly, rgbToHex} from '../utilities/utils';
import {Visualizer} from '../visuals/Visualizer';

// This should not have nested properties!
export interface MatrixOptions {			// Listed in the order they are processed in
	roomName: string;						// Name of the room
	roomVisibile: boolean;					// Whether the room is visible
	explicitTerrainCosts: boolean;			// If true, call MatrixLib.addTerrainCosts(matrix, roomName, terrainCosts)
	plainCost: number;						// Cost of plain tiles
	swampCost: number;						// Cost of swamp tiles
	roadCost: number | 'auto' | undefined;	// Cost of roads; 'auto' = set to ceil(plain/2); undefined = ignore
	blockExits: boolean;					// Whether to block the exits; shouldn't be used with exitCosts
	avoidSK: boolean;						// Avoid getting near source keepers
	allowPortals: boolean;					// Portals will be soft-blocked unless this is true
	ignoreStructures: boolean;				// Ignore structures (excluding roads) and impassible construction sites
	obstacles: string;						// Obstacles packed as packPos (not packCoord!); should rarely change
	swarmWidth: number;						// The width of the squad (if any); >1 calls MatrixLib.applyMovingMaximum()
	swarmHeight: number;					// The height of the squad (if any); >1 calls MatrixLib.applyMovingMaximum()
}

// This describes matrix options that generally only last for one tick. All properties here should be optional!
export interface VolatileMatrixOptions {
	blockCreeps?: boolean;					// Whether to block creeps (default is undefined -> false)
}

const getDefaultMatrixOptions: () => MatrixOptions = () => ({
	roomName            : 'none',	// overridden in MatrixLib.getMatrix()
	roomVisibile        : false,	// overridden in MatrixLib.getMatrix()
	explicitTerrainCosts: false,
	plainCost           : 1,
	swampCost           : 5,
	roadCost            : 'auto',
	blockExits          : false,
	avoidSK             : true,
	allowPortals        : false,
	ignoreStructures    : false,
	obstacles           : '',
	swarmWidth          : 1,
	swarmHeight         : 1,
});


const getDefaultVolatileMatrixOptions: () => VolatileMatrixOptions = () => ({});

PERMACACHE.terrainMatrices = PERMACACHE.terrainMatrices || {};

const MatrixCache: {
	[hash: string]: {
		matrix: CostMatrix;
		generated: number;
		expiration?: number;
		invalidateCondition?: () => boolean;
	}
} = {};


/**
 * MatrixLib contains an assortment of CostMatrix-related manipulation functions. I use C-style loops in most of this
 * library because even though they are ugly af, they are significantly (~20x!) faster than _.forEach or
 * for (const thing of things) { } loops.
 */
@profile
export class MatrixLib {

	static settings = {
		portalCost: 20, // if portals are not blocked, we still want to avoid accidentally stepping on them
	};

	static getMatrix(roomName: string, opts: Partial<MatrixOptions>,
					 volatileOpts: VolatileMatrixOptions = {}): CostMatrix {
		// Copy the opts objects because we don't want to back-modify it
		opts = _.defaults(_.cloneDeep(opts), getDefaultMatrixOptions());
		volatileOpts = _.cloneDeep(volatileOpts);

		const room = Game.rooms[roomName] as Room | undefined;
		opts.roomVisibile = !!Game.rooms[roomName];

		// Generate a hash to look up any previously cached matrices
		const hash = MatrixLib.generateMatrixOptionsHash(<MatrixOptions>opts);

		// Volatile hash gets added to hash; if no volatile options are specified; use empty string to not change hash
		const volatileHash = _.isEmpty(volatileOpts) ? '' : MatrixLib.generateMatrixOptionsHash(volatileOpts);

		// If you have previously cached this matrix with volatile properties and it's still valid, return that
		// If no volatile opts are specified; the method will usually return from this block of code
		if (MatrixCache[hash + volatileHash]) {
			const expiration = MatrixCache[hash + volatileHash].expiration || Infinity;
			const invalidateCondition = MatrixCache[hash + volatileHash].invalidateCondition || (() => false);
			if (Game.time >= expiration || invalidateCondition()) {
				delete MatrixCache[hash + volatileHash];
			} else {
				return MatrixCache[hash + volatileHash].matrix;
			}
		}

		let matrix: CostMatrix | undefined;
		let expiration: number;
		let invalidateCondition: () => boolean;

		// If you've previously cached a matrix with the same non-volatile opts; start from there and then modify it
		if (MatrixCache[hash]) {
			expiration = MatrixCache[hash].expiration || Infinity;
			invalidateCondition = MatrixCache[hash].invalidateCondition || (() => false);
			if (Game.time >= expiration || invalidateCondition()) {
				delete MatrixCache[hash];
				matrix = undefined;
			} else {
				matrix = MatrixCache[hash].matrix;
			}
		}

		// Otherwise we'll build a base matrix for the non-volatile options, cache it, then modify it for volatile opts
		if (matrix === undefined) {
			if (room) {
				matrix = MatrixLib.generateCostMatrixForRoom(room, <MatrixOptions>opts);
				const roomOwner = RoomIntel.roomOwnedBy(roomName);
				if (Cartographer.roomType(roomName) == ROOMTYPE_SOURCEKEEPER) {
					expiration = Game.time + 10;
				} else if (roomOwner && !isAlly(roomOwner)) {
					expiration = Game.time + 25;
				} else {
					expiration = Game.time + 100;
				}
				if (opts.ignoreStructures) {
					invalidateCondition = () => false;
				} else {
					// Invalidate the path if the number of structures in the room changes
					const numStructures = room.structures.length;
					invalidateCondition = () => Game.rooms[roomName].structures.length != numStructures;
				}
			} else {
				matrix = MatrixLib.generateCostMatrixForInvisibleRoom(roomName, <MatrixOptions>opts);
				const roomOwner = RoomIntel.roomOwnedBy(roomName);
				if (roomOwner && !isAlly(roomOwner)) {
					expiration = Game.time + 100;
				} else {
					expiration = Game.time + 1000;
				}
				invalidateCondition = () => false;
			}

			// Cache the results for the non-volatile options
			MatrixCache[hash] = {
				matrix             : matrix,
				generated          : Game.time,
				expiration         : expiration,
				invalidateCondition: invalidateCondition,
			};
		}

		// If there's no modifications we need to make, we're done, so return the matrix
		if (_.isEmpty(volatileOpts)) {
			return MatrixCache[hash].matrix;
		}

		// Otherwise, clone the matrix and apply volatile modifications, then cache it for this tick
		const clonedMatrix = matrix.clone();

		MatrixLib.applyVolatileModifications(clonedMatrix, <MatrixOptions>opts, volatileOpts);

		// Cache the results for the non-volatile options
		MatrixCache[hash+volatileHash] = {
			matrix             : clonedMatrix,
			generated          : Game.time,
			expiration         : Game.time + 1, // only sits around for this tick
			invalidateCondition: () => false,	// invalidated next tick so we don't need an invalidation condition
		};

		return MatrixCache[hash+volatileHash].matrix;

	}

	/**
	 * Generate a deterministic string hash that you can store a costmatrix with
	 */
	private static generateMatrixOptionsHash(opts: MatrixOptions | VolatileMatrixOptions): string {
		return JSON.stringify(opts, Object.keys(opts).sort());
	}

	/**
	 * Applies modificaitons to account for volatile options. Make sure to clone the matrix before passing it to this!
	 */
	private static applyVolatileModifications(clonedMatrix: CostMatrix, opts: MatrixOptions,
											  volatileOpts: VolatileMatrixOptions): CostMatrix {
		const room = Game.rooms[opts.roomName] as Room | undefined;

		// Block creep positions
		if (volatileOpts.blockCreeps) {
			if (room) {
				if (opts.swarmWidth > 1 || opts.swarmHeight > 1) {

				} else {
					MatrixLib.block(clonedMatrix, _.map(room.find(FIND_CREEPS), creep => creep.pos));
				}
			} else {
				// Can't block creeps without vision
			}
		}

		return clonedMatrix;

	}

	/**
	 * Generates a cost matrix for a visible room based on the fully-specified matrix options
	 */
	private static generateCostMatrixForRoom(room: Room, opts: MatrixOptions): CostMatrix {

		const matrix = new PathFinder.CostMatrix();

		// Explicitly specify the terrain costs if needed
		if (opts.explicitTerrainCosts) {
			const terrainCosts: TerrainCosts = {plainCost: opts.plainCost, swampCost: opts.swampCost};
			MatrixLib.addTerrainCosts(matrix, room.name, terrainCosts);
		}

		// Set road costs, usually to plainCost / 2
		if (opts.roadCost !== undefined) {
			if (opts.roadCost == 'auto') {
				opts.roadCost = Math.ceil(opts.plainCost / 2);
			}
			for (const road of room.roads) {
				matrix.set(road.pos.x, road.pos.y, opts.roadCost);
			}
		}

		// Mark the exits as unpathable
		if (opts.blockExits) {
			MatrixLib.blockExits(matrix);
		}

		// Avoid source keepers
		if (opts.avoidSK && Cartographer.roomType(room.name) == ROOMTYPE_SOURCEKEEPER) {
			const skDirective = _.first(DirectiveSKOutpost.findInRoom(room.name));
			// Skip this step if we've been harvesting from the room for a while
			if (!(skDirective && skDirective.age > 2500)) {
				const keeperLairInfo = RoomIntel.getKeeperLairInfo(room.name);
				const chillPositions = _.compact(_.map(keeperLairInfo || [], info => info.chillPos)) as RoomPosition[];
				const blockPositions: RoomPosition[] = [
					..._.map(room.sourceKeepers, keeper => keeper.pos),
					..._.map(room.keeperLairs.filter(lair => (lair.ticksToSpawn || Infinity) < 100), lair => lair.pos),
					...chillPositions];
				MatrixLib.blockWithinRange(matrix, blockPositions, 3);
			}
		}

		// Block or soft-block portals
		if (opts.allowPortals) {
			MatrixLib.softBlock(matrix, room.portals, room.name, MatrixLib.settings.portalCost);
		} else {
			MatrixLib.block(matrix, room.portals);
		}

		// Block structure positions
		if (!opts.ignoreStructures) {
			const impassibleStructures = _.filter(room.structures, s => !s.isWalkable);
			const impassibleConstructionSites = _.filter(room.constructionSites, c => !c.isWalkable);
			const alliedConstructionSites = _.filter(room.hostileConstructionSites, c => isAlly(c.owner.username));
			const blockPositions = _.map([...impassibleStructures,
										  ...impassibleConstructionSites,
										  ...alliedConstructionSites], s => s.pos) as RoomPosition[];
			MatrixLib.block(matrix, blockPositions);
		}

		// Block any other obstacles that might be specified
		if (opts.obstacles.length > 0) {
			const obstacles = _.filter(unpackPosList(opts.obstacles), pos => pos.roomName == room.name);
			MatrixLib.block(matrix, obstacles);
		}

		return matrix;

	}

	/**
	 * Generates a cost matrix for an invisible room based on the fully-specified matrix options
	 */
	private static generateCostMatrixForInvisibleRoom(roomName: string, opts: Full<MatrixOptions>): CostMatrix {

		const matrix = new PathFinder.CostMatrix();

		// Explicitly specify the terrain costs if needed
		if (opts.explicitTerrainCosts) {
			const terrainCosts: TerrainCosts = {plainCost: opts.plainCost, swampCost: opts.swampCost};
			MatrixLib.addTerrainCosts(matrix, roomName, terrainCosts);
		}

		// Set road costs, usually to plainCost / 2
		if (opts.roadCost !== undefined) {
			// Can't do anything here // TODO: maybe I should track road positions?
		}

		// Mark the exits as unpathable
		if (opts.blockExits) {
			MatrixLib.blockExits(matrix);
		}

		// Avoid source keepers
		if (opts.avoidSK && Cartographer.roomType(roomName) == ROOMTYPE_SOURCEKEEPER) {
			const skDirective = _.first(DirectiveSKOutpost.findInRoom(roomName));
			// Skip this step if we've been harvesting from the room for a while
			if (!(skDirective && skDirective.age > 2500)) {
				const keeperLairInfo = RoomIntel.getKeeperLairInfo(roomName);
				const chillPositions = _.compact(_.map(keeperLairInfo || [], info => info.chillPos)) as RoomPosition[];
				MatrixLib.blockWithinRange(matrix, chillPositions, 3);
			}
		}

		// Block or soft-block portals
		const portalPositions = _.map(RoomIntel.getPortalInfo(roomName), portalInfo => portalInfo.pos);
		if (opts.allowPortals) {
			MatrixLib.softBlock(matrix, portalPositions, roomName, MatrixLib.settings.portalCost);
		} else {
			MatrixLib.block(matrix, portalPositions);
		}

		// Block positions of structures you remember
		if (!opts.ignoreStructures) {
			const owner = RoomIntel.roomOwnedBy(roomName) || '_noOwner_';
			const info = RoomIntel.getImportantStructureInfo(roomName);
			if (info) {
				if (!isAlly(owner)) MatrixLib.block(matrix, info.rampartPositions);
				MatrixLib.block(matrix, info.wallPositions);
				MatrixLib.block(matrix, info.towerPositions);
				MatrixLib.block(matrix, info.spawnPositions);
				if (info.storagePos) MatrixLib.block(matrix, [info.storagePos]);
				if (info.terminalPos) MatrixLib.block(matrix, [info.terminalPos]);
			}
		}

		// Block any other obstacles that might be specified
		if (opts.obstacles.length > 0) {
			const obstacles = _.filter(unpackPosList(opts.obstacles), pos => pos.roomName == roomName);
			MatrixLib.block(matrix, obstacles);
		}

		return matrix;
	}

	/**
	 * Adds two matrices in-place on the first matrix. This method modifies the first matrix and does not modify the
	 * second matrix. This method accesses the non-api CostMatrix._bits property so it may break in the future if they
	 * modify the mechanics of cost matrices. See this file for details:
	 * https://github.com/screeps/engine/blob/master/src/game/path-finder.js
	 */
	static addMatrices(matrixToModify: CostMatrix, addCosts: CostMatrix): CostMatrix {
		for (let i = 0; i < 2500; i++) {
			matrixToModify._bits[i] = Math.min(Math.max(0, matrixToModify._bits[i] + addCosts._bits[i]), 255);
		}
		return matrixToModify;
	}


	/**
	 * Blocks all specified positions, setting their cost to 0xff
	 */
	static block(matrix: CostMatrix, positions: (RoomPosition | HasPos)[]): CostMatrix {
		let pos: RoomPosition;
		for (let i = 0; i < positions.length; i++) {
			pos = normalizePos(positions[i]);
			matrix.set(pos.x, pos.y, 0xff);
		}
		return matrix;
	}

	/**
	 * Sets the cost of all positions to a value if walls are not present and if the value is above the current value
	 */
	static softBlock(matrix: CostMatrix, positions: (RoomPosition | HasPos)[],
					 roomName: string, cost: number): CostMatrix {
		let pos: RoomPosition;
		const terrain = Game.map.getRoomTerrain(roomName);
		for (let i = 0; i < positions.length; i++) {
			pos = normalizePos(positions[i]);
			if (terrain.get(pos.x, pos.y) & TERRAIN_MASK_WALL) continue;
			matrix.set(pos.x, pos.y, Math.max(cost, matrix.get(pos.x, pos.y)));
		}
		return matrix;
	}

	/**
	 * Blocks all squares within a range (inclusive) of a list of positions, setting their cost to 0xff
	 */
	static blockWithinRange(matrix: CostMatrix, positions: RoomPosition[], range: number): CostMatrix {
		let x, y: number;
		let pos: RoomPosition;
		for (let i = 0; i < positions.length; i++) {
			pos = positions[i];
			for (let dx = -range; dx <= range; dx++) {
				x = pos.x + dx;
				if (x < 0 || x > 49) continue;
				for (let dy = -range; dy <= range; dy++) {
					y = pos.y + dy;
					if (y < 0 || y > 49) continue;
					matrix.set(x, y, 0xff);
				}
			}
		}
		return matrix;
	}


	/**
	 * Sets impassible structure positions to 0xff
	 */
	static blockImpassibleStructures(matrix: CostMatrix, room: Room): CostMatrix {
		const impassibleStuctures = _.filter(room.find(FIND_STRUCTURES), (s: Structure) => !s.isWalkable);
		const blockPositions = _.map(impassibleStuctures, s => s.pos);
		MatrixLib.block(matrix, blockPositions);
		return matrix;
	}


	/**
	 * Adds a pyramid-shaped potential to the cost matrix centered around the target position and extending to a
	 * specified range with a maximum cost. MaxCost must be divisible by range+1 or an error is thrown. If
	 * includeTerrainCosts=true (by default) then if the cost for a square is zero, the terrain cost of the tile is
	 * added using default costs of {plain: 1, swamp: 5}. For example, the relevant portion of the return matrix of
	 * MatrixLib.addPyramidPotential(zeroMatrix, pos, range=2, maxCost=6) is:
	 *
	 *     0 0 0 0 0 0 0
	 *     0 2 2 2 2 2 0
	 *     0 2 4 4 4 2 0
	 *     0 2 4 6 4 2 0
	 *     0 2 4 4 4 2 0
	 *     0 2 2 2 2 2 0
	 *     0 0 0 0 0 0 0
	 */
	static addPyramidPotential(matrix: CostMatrix, pos: RoomPosition | HasPos, range: number, maxCost: number,
							   includeTerrain             = true, // don't use includeTerrain with explicitTerrainCosts!
							   terrainCosts: TerrainCosts = {plainCost: 1, swampCost: 5}): CostMatrix {

		if (Math.floor(maxCost / range) != maxCost / range) {
			log.error(`MatrixLib.addPyramidPotential: maxCost must be divisible by (range+1)!`);
			return matrix;
		}

		pos = normalizePos(pos);
		const terrain = Game.map.getRoomTerrain(pos.roomName);

		const slope = maxCost / (range + 1);
		let x, y, dx, dy, r, cost: number;
		for (dx = -range; dx <= range; dx++) {
			x = pos.x + dx;
			if (x < 0 || x > 49) continue;
			for (dy = -range; dy <= range; dy++) {
				y = pos.y + dy;
				if (y < 0 || y > 49) continue;

				const terrain = Game.map.getRoomTerrain(pos.roomName);

				cost = matrix.get(x, y);
				if (includeTerrain) {
					if (cost === 0) {
						if (terrain.get(x, y) & TERRAIN_MASK_SWAMP) {
							cost += terrainCosts.swampCost;
						} else {
							cost += terrainCosts.plainCost;
						}
					}
				}

				r = Math.max(Math.abs(dx), Math.abs(dy));
				cost += slope * (range + 1 - r);
				matrix.set(x, y, cost); // cost can exceed 0xff since it is min-maxed in backend
			}
		}
		return matrix;
	}


	/**
	 * Adds a square potential with a specified center and range. If includeTerrainCosts=true (by default) then if the
	 * cost for a square is zero, the terrain cost of the tile is added using default costs of {plain: 1, swamp: 5}.
	 */
	static addSquarePotential(matrix: CostMatrix, pos: RoomPosition | HasPos, range: number, addCost: number,
							  includeTerrain             = true, // don't use includeTerrain with explicitTerrainCosts!
							  terrainCosts: TerrainCosts = {plainCost: 1, swampCost: 5}): CostMatrix {

		pos = normalizePos(pos);

		const terrain = Game.map.getRoomTerrain(pos.roomName);

		let x, y, dx, dy, cost: number;
		for (dx = -range; dx <= range; dx++) {
			x = pos.x + dx;
			if (x < 0 || x > 49) continue;
			for (dy = -range; dy <= range; dy++) {
				y = pos.y + dy;
				if (y < 0 || y > 49) continue;

				if (terrain.get(x, y) & TERRAIN_MASK_WALL) continue;

				cost = matrix.get(x, y);
				if (includeTerrain) {
					if (cost === 0) {
						if (terrain.get(x, y) & TERRAIN_MASK_SWAMP) {
							cost += terrainCosts.swampCost;
						} else {
							cost += terrainCosts.plainCost;
						}
					}
				}

				matrix.set(x, y, addCost + cost); // cost can exceed 0xff since it is min-maxed in backend
			}
		}
		return matrix;
	}


	/**
	 * Transform a CostMatrix such that the cost at each point is transformed to the max of costs in a width x height
	 * window (indexed from upper left corner). This requires that terrain be explicitly specified in the matrix!
	 */
	static applyMovingMaximum(matrix: CostMatrix, width: number, height: number): CostMatrix {
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
		return matrix;
	}

	/**
	 * Sets the cost of all walkable positions within range of a target position or object. If add=true, adds the cost
	 * to the existing cost of the tile. If the cost for a square is zero, the terrain cost of the tile is added
	 * using implicit costs of {plain: 1, swamp: 5}
	 */
	static setInRange(matrix: CostMatrix, pos: RoomPosition | HasPos, range: number, cost: number,
					  addDefaultTerrainCosts = false): CostMatrix {

		pos = normalizePos(pos);
		const terrain = Game.map.getRoomTerrain(pos.roomName);

		let x, y, dx, dy, currentCost: number;
		for (dx = -range; dx <= range; dx++) {
			x = pos.x + dx;
			if (x < 0 || x > 49) continue;
			for (dy = -range; dy <= range; dy++) {
				y = pos.y + dy;
				if (y < 0 || y > 49) continue;
				if (terrain.get(x, y) & TERRAIN_MASK_WALL) continue;

				currentCost = matrix.get(x, y);
				if (currentCost === 0) {
					if (terrain.get(x, y) & TERRAIN_MASK_SWAMP) {
						currentCost += 10;
					} else {
						currentCost += 2;
					}
				}
				// if (currentCost >= 0xff || currentCost > cost) continue; // not necessary, done in backend
				matrix.set(x, y, addDefaultTerrainCosts ? cost + currentCost : cost);
			}
		}
		return matrix;
	}

	/**
	 * Get a matrix of explicit terrain cost values for a room given specified movement costs. The matrix is stored
	 * in the permacache. By default, a cloned matrix is returned which you may safely modify, but if you know what
	 * you are doing, you can set skipClone=true.
	 */
	static getTerrainMatrix(roomName: string, terrainCosts: TerrainCosts = {plainCost: 1, swampCost: 5},
							skipClone                                    = false): CostMatrix {
		const key = `${roomName}:${terrainCosts.plainCost}:${terrainCosts.swampCost}`;
		if (PERMACACHE.terrainMatrices[key] === undefined) {
			// This takes about 0.2 to 0.4 CPU to generate
			const matrix = new PathFinder.CostMatrix();
			const terrain = Game.map.getRoomTerrain(roomName);
			for (let y = 0; y < 50; ++y) {
				for (let x = 0; x < 50; ++x) {
					switch (terrain.get(x, y)) {
						case TERRAIN_MASK_SWAMP:
							matrix.set(x, y, terrainCosts.swampCost);
							break;
						case TERRAIN_MASK_WALL:
							matrix.set(x, y, 0xff);
							break;
						default: // plain
							matrix.set(x, y, terrainCosts.plainCost);
							break;
					}
				}
			}
			PERMACACHE.terrainMatrices[key] = matrix;
		}
		if (skipClone) {
			return PERMACACHE.terrainMatrices[key];
		}
		return PERMACACHE.terrainMatrices[key].clone();
	}


	/**
	 * Adds the terrain costs to an existing cost matrix
	 */
	static addTerrainCosts(matrix: CostMatrix, roomName: string,
						   terrainCosts: TerrainCosts = {plainCost: 1, swampCost: 5}): CostMatrix {
		const terrainMatrix = MatrixLib.getTerrainMatrix(roomName, terrainCosts, true);
		MatrixLib.addMatrices(matrix, terrainMatrix);
		return matrix;
	}


	/**
	 * Blocks all tiles at the edge of the room. If rangeToEdge is specified, block all tiles within that range of
	 * the edge.
	 */
	static blockExits(matrix: CostMatrix, rangeToEdge = 0): CostMatrix {
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
		return matrix;
	}

	/**
	 * Sets the cost of all walkable tiles at the edge of the room. If rangeToEdge is specified, set the cost of
	 * all walkable terrain tiles within that range of the edge.
	 */
	static setExitCosts(matrix: CostMatrix, roomName: string, cost: number, rangeToEdge = 0): CostMatrix {
		const terrain = Game.map.getRoomTerrain(roomName);

		for (let x = rangeToEdge; x < 50 - rangeToEdge; x += 49 - rangeToEdge * 2) {
			for (let y = rangeToEdge; y < 50 - rangeToEdge; y++) {
				if (terrain.get(x, y) & TERRAIN_MASK_WALL) {
					continue;
				}
				matrix.set(x, y, cost);
			}
		}
		for (let x = rangeToEdge; x < 50 - rangeToEdge; x++) {
			for (let y = rangeToEdge; y < 50 - rangeToEdge; y += 49 - rangeToEdge * 2) {
				if (terrain.get(x, y) & TERRAIN_MASK_WALL) {
					continue;
				}
				matrix.set(x, y, cost);
			}
		}
		return matrix;
	}

	/**
	 * Sets all creep positions to impassible
	 */
	static blockMyCreeps(matrix: CostMatrix, room: Room) {
		_.forEach(room.creeps, creep => {
			matrix.set(creep.pos.x, creep.pos.y, 0xff);
		});
	}

	/**
	 * Sets hostile creep positions to impassible
	 */
	static blockHostileCreeps(matrix: CostMatrix, room: Room) {
		_.forEach(room.hostiles, hostile => {
			matrix.set(hostile.pos.x, hostile.pos.y, 0xff);
		});
	}

	/**
	 * Sets all creep positions to impassible
	 */
	static blockAllCreeps(matrix: CostMatrix, room: Room) {
		_.forEach(room.find(FIND_CREEPS), creep => {
			matrix.set(creep.pos.x, creep.pos.y, 0xff);
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
	 * Gets the rows of a CostMatrix and returns as a list of 50 Uint8Arrays
	 */
	static getRows(matrix: CostMatrix): Uint8Array[] {
		const rows: Uint8Array[] = [];
		for (let y = 0; y < 50; ++y) {
			rows.push(new Uint8Array(50));
			for (let x = 0; x < 50; ++x) {
				rows[y][x] = matrix.get(x, y);
			}
		}
		return rows;
	}

	/**
	 * Gets the columns of a CostMatrix and returns as a list of 50 Uint8Arrays
	 */
	static getColumns(matrix: CostMatrix): Uint8Array[] {
		const columns: Uint8Array[] = [];
		for (let x = 0; x < 50; ++x) {
			columns.push(new Uint8Array(50));
			for (let y = 0; y < 50; ++y) {
				columns[x][y] = matrix.get(x, y);
			}
		}
		return columns;
	}

	/**
	 * Returns the maximum value of any matrix element
	 */
	static getMaxValue(matrix: CostMatrix): number {
		return _.max(matrix._bits);
	}

	/**
	 * Prints the values of a CostMatrix to the console. This is pretty expensive!
	 */
	static print(matrix: CostMatrix, opts = {equalSpacing: true, useColorMap: true}): void {
		// Figure out how big the largest value in a column is so we can align them right
		const longestNumPerColumn: number[] = _.map(MatrixLib.getColumns(matrix),
													column => _.max(_.map(column, n => n.toString().length)));
		if (opts.equalSpacing) {
			const longestNum = _.max(longestNumPerColumn);
			for (let i = 0; i < longestNumPerColumn.length; ++i) {
				longestNumPerColumn[i] = longestNum;
			}
		}

		const maxVal = MatrixLib.getMaxValue(matrix);

		let msg = '';
		let num: number, percentOfMax: number, numAsStr: string;
		for (let y = 0; y < 50; ++y) {
			for (let x = 0; x < 50; ++x) {
				num = matrix.get(x, y);
				numAsStr = matrix.get(x, y).toString().padEnd(longestNumPerColumn[x] + 1);
				if (opts.useColorMap && maxVal > 0) {
					percentOfMax = Math.round(255 * num / maxVal);
					msg += color(numAsStr, rgbToHex(255, 255 - percentOfMax, 255 - percentOfMax));
				} else {
					msg += numAsStr;
				}

			}
			msg += '\n';
		}

		console.log(msg);
	}

	/**
	 * Visualizes the cost matrix as a room visual. Shortcut to Visualizer.displayCostMatrix()
	 */
	static visualize(matrix: CostMatrix, roomName?: string): void {
		Visualizer.displayCostMatrix(matrix, roomName);
	}

	static testMatrices: { [key: string]: () => CostMatrix } = {
		checkerboard      : () => {
			const matrix = new PathFinder.CostMatrix();
			for (let y = 0; y < 50; ++y) {
				for (let x = 0; x < 50; ++x) {
					matrix.set(x, y, (x + y) % 2);
				}
			}
			return matrix;
		},
		checkerboard2     : () => {
			const matrix = new PathFinder.CostMatrix();
			for (let y = 0; y < 50; ++y) {
				for (let x = 0; x < 50; ++x) {
					matrix.set(x, y, (x + y + 1) % 2);
				}
			}
			return matrix;
		},
		xIncreasing       : () => {
			const matrix = new PathFinder.CostMatrix();
			for (let y = 0; y < 50; ++y) {
				for (let x = 0; x < 50; ++x) {
					matrix.set(x, y, x);
				}
			}
			return matrix;
		},
		yIncreasing       : () => {
			const matrix = new PathFinder.CostMatrix();
			for (let y = 0; y < 50; ++y) {
				for (let x = 0; x < 50; ++x) {
					matrix.set(x, y, y);
				}
			}
			return matrix;
		},
		diagonalIncreasing: () => {
			const matrix = new PathFinder.CostMatrix();
			for (let y = 0; y < 50; ++y) {
				for (let x = 0; x < 50; ++x) {
					matrix.set(x, y, x + y);
				}
			}
			return matrix;
		}
	};

}

global.MatrixLib = MatrixLib;

