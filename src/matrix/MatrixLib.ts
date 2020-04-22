/* tslint:disable:no-bitwise prefer-for-of */

import {log} from '../console/log';
import {RoomIntel} from '../intel/RoomIntel';
import {normalizePos} from '../movement/helpers';
import {TerrainCosts} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../utilities/Cartographer';
import {unpackPosList} from '../utilities/packrat';
import {color, isAlly, rgbToHex} from '../utilities/utils';
import {Visualizer} from '../visuals/Visualizer';

// Properties and sub-properties here shouldn't be undefined
export interface MatrixOptions {			// Listed in the order they are processed in
	roomName: string;						// Name of the room
	roomVisibile: boolean;					// Whether the room is visible
	explicitTerrainCosts: boolean;			// If true, call MatrixLib.addTerrainCosts(matrix, roomName, terrainCosts)
	terrainCosts: TerrainCosts;				// terrain costs, determined automatically for creep body if unspecified
	roadCost: number | 'auto' | 'ignore';	// road costs; 'auto' = set to ceil(plain/2); 'ignore' = ignore roads
	blockExits: boolean;					// Whether to block the exits; shouldn't be used with exitCosts
	avoidSK: boolean;						// Avoid getting near source keepers
	allowPortals: boolean;					// Portals are hard-blocked if false; soft-blocked if true
	ignoreStructures: boolean;				// Ignore structures (excluding roads) and impassible construction sites
	obstacles: string;						// Obstacles packed as packPos (not packCoord!); should rarely change
	swarmWidth: number;						// The width of the squad (if any); >1 calls MatrixLib.applyMovingMaxPool()
	swarmHeight: number;					// The height of the squad (if any); >1 calls MatrixLib.applyMovingMaxPool()
}

export const getDefaultMatrixOptions: () => MatrixOptions = () => ({
	roomName            : 'none',
	roomVisibile        : false,
	explicitTerrainCosts: false,
	terrainCosts        : {
		plainCost: 1,
		swampCost: 5,
	},
	roadCost            : 'auto',
	blockExits          : false,
	avoidSK             : true,
	allowPortals        : false,
	ignoreStructures    : false,
	obstacles           : '',
	swarmWidth          : 1,
	swarmHeight         : 1,
});

// This describes matrix options that generally only last for one tick. All properties here should be optional!
export interface VolatileMatrixOptions {
	blockCreeps?: boolean;	// Whether to block creeps (default is undefined -> false)
}


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

		// Populate roomName and roomVisible properties
		const room = Game.rooms[roomName] as Room | undefined;
		opts.roomName = roomName;
		opts.roomVisibile = !!room;

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
					invalidateCondition =
						() => Game.rooms[roomName] && Game.rooms[roomName].structures.length != numStructures;
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
		MatrixCache[hash + volatileHash] = {
			matrix             : clonedMatrix,
			generated          : Game.time,
			expiration         : Game.time + 1, // only sits around for this tick
			invalidateCondition: () => false,	// invalidated next tick so we don't need an invalidation condition
		};

		return MatrixCache[hash + volatileHash].matrix;

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
					MatrixLib.blockAfterMaxPooling(clonedMatrix, room.find(FIND_CREEPS),
												   opts.swarmWidth, opts.swarmHeight);
				} else {
					// use soft-block to avoid creeps but not result in unpathable errors
					MatrixLib.softBlock(clonedMatrix, room.find(FIND_CREEPS), opts.roomName,100);
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
			MatrixLib.addTerrainCosts(matrix, room.name, opts.terrainCosts);
		}

		// Set road costs, usually to plainCost / 2
		if (opts.roadCost != 'ignore') {
			if (opts.roadCost == 'auto') {
				opts.roadCost = Math.ceil(opts.terrainCosts.plainCost / 2);
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
			// Skip this step if we've been harvesting from the room for a while
			const skDirective = _.find(Overmind.overseer.getDirectivesInRoom(room.name), dir =>
				dir.directiveName == 'outpostSK'); // had to do this ungly thing due to circular dependency problems :(
			// const skDirective = _.first(DirectiveSKOutpost.findInRoom(roomName));

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

		// Finally, as the very last step, we apply a smear to account for swarm size if greater than 1x1
		if (opts.swarmWidth > 1 || opts.swarmHeight > 1) {
			if (!opts.explicitTerrainCosts) {
				log.error(`Swarm matrix generation requires opts.explicitTerrainCosts! opts: ${JSON.stringify(opts)}`);
			}
			MatrixLib.applyMovingMaxPool(matrix, opts.swarmWidth, opts.swarmHeight);
		}

		// Tada!
		return matrix;

	}

	/**
	 * Generates a cost matrix for an invisible room based on the fully-specified matrix options
	 */
	private static generateCostMatrixForInvisibleRoom(roomName: string, opts: Full<MatrixOptions>): CostMatrix {

		const matrix = new PathFinder.CostMatrix();

		// Explicitly specify the terrain costs if needed
		if (opts.explicitTerrainCosts) {
			MatrixLib.addTerrainCosts(matrix, roomName, opts.terrainCosts);
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
			// Skip this step if we've been harvesting from the room for a while
			const skDirective = _.find(Overmind.overseer.getDirectivesInRoom(roomName), dir =>
				dir.directiveName == 'outpostSK'); // had to do this ungly thing due to circular dependency problems :(
			// const skDirective = _.first(DirectiveSKOutpost.findInRoom(roomName));

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

		// Finally, as the very last step, we apply a smear to account for swarm size if greater than 1x1
		if (opts.swarmWidth > 1 || opts.swarmHeight > 1) {
			if (!opts.explicitTerrainCosts) {
				log.error(`Swarm matrix generation requires opts.explicitTerrainCosts! opts: ${JSON.stringify(opts)}`);
			}
			MatrixLib.applyMovingMaxPool(matrix, opts.swarmWidth, opts.swarmHeight);
		}

		// Tada!
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
	 * Quickly fills an entire matrix with a value. This method accesses the non-api CostMatrix._bits property so
	 * it may break in the future if they modify the mechanics of cost matrices. See this file for details:
	 * https://github.com/screeps/engine/blob/master/src/game/path-finder.js
	 */
	static fillMatrix(matrixToModify: CostMatrix, value: number): CostMatrix {
		value = Math.min(Math.max(0, value), 255);
		matrixToModify._bits.fill(value);
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
	 * window (indexed from upper left corner). This is basically a 2D max-pool operation except that the pooling
	 * window moves with the max-kernel.
	 * -> This method requires that terrain be explicitly specified in the matrix!
	 */
	static applyMovingMaxPool(matrix: CostMatrix, width: number, height: number): CostMatrix {
		// Since we're moving in increasing order of x, y, we don't need to clone the matrix
		let x, y, dx, dy: number;
		let maxCost, cost: number;
		for (x = 0; x <= 50 - width; x++) {
			for (y = 0; y <= 50 - height; y++) {
				maxCost = matrix.get(x, y);
				for (dx = 0; dx < width; dx++) {
					for (dy = 0; dy < height; dy++) {
						// Don't need 0 <= x,y <= 49 safety checks here since 0 <= x <= (50 - w + (w-1)) = 49
						cost = matrix.get(x + dx, y + dy);
						if (cost > maxCost) maxCost = cost;
					}
				}
				matrix.set(x, y, maxCost);
			}
		}
		return matrix;
	}

	/**
	 * Blocks all specified positions for a swarm cost matrix that has already been "smeared" by
	 * MatrixLib.applyMovingMaxPool().
	 * -> Do not run additional passes of applyMovingMaxPool after doing this!
	 * -> This method assumes that you have already added explicit terrian costs.
	 */
	static blockAfterMaxPooling(matrix: CostMatrix, positions: (RoomPosition | HasPos)[],
								width: number, height: number): CostMatrix {
		let pos: RoomPosition;
		let x, y, dx, dy: number;
		for (let i = 0; i < positions.length; ++i) {
			pos = normalizePos(positions[i]);
			for (dx = 0; dx > -width; dx--) {
				x = pos.x + dx;
				if (x < 0 || x > 49) continue;
				for (dy = 0; dy > -height; dy--) {
					y = pos.y + dy;
					if (y < 0 || y > 49) continue;
					matrix.set(x, y, 0xff);
				}
			}
		}
		return matrix;
	}

	/**
	 * Sets the effective cost of all specified positions for a swarm cost matrix that has already been "smeared" by
	 * MatrixLib.applyMovingMaxPool(). The cost for each tile is the maximum of the set cost and the current cost.
	 * -> Do not run additional passes of applyMovingMaxPool after doing this!
	 * -> This method assumes that you have already added explicit terrain costs.
	 * Example -----------------------------------------------------------------------------------------------------
	 * Start       SetCost     MaxPool    |    Start       MaxPool     SetToMaxCostAfterMaxPooling
	 * 0 0 0 0     0 0 0 0     1 5 5 0    |    0 0 0 0     1 2 2 0     1 5 5 0
	 * 0 1 2 0     0 1 5 0     9 9 5 0    |    0 1 2 0     9 9 2 0     9 9 5 0
	 * 0 9 0 0     0 9 5 0     9 9 5 1    |    0 9 0 0     9 9 1 1     9 9 5 1
	 * 0 0 0 1     0 0 0 1     0 0 1 1    |    0 0 0 1     0 0 1 1     0 0 1 1
	 */
	static setToMaxCostAfterMaxPooling(matrix: CostMatrix, positions: (RoomPosition | HasPos)[],
									   width: number, height: number, cost: number): CostMatrix {
		let pos: RoomPosition;
		let x, y, dx, dy: number;
		for (let i = 0; i < positions.length; ++i) {
			pos = normalizePos(positions[i]);
			for (dx = 0; dx > -width; dx--) {
				x = pos.x + dx;
				if (x < 0 || x > 49) continue;
				for (dy = 0; dy > -height; dy--) {
					y = pos.y + dy;
					if (y < 0 || y > 49) continue;
					if (matrix.get(x, y) < cost) {
						matrix.set(x, y, cost);
					}
				}
			}
		}
		return matrix;
	}

	/**
	 * Adds an extra cost to the effective specified positions for a swarm cost matrix that has already been "smeared"
	 * by MatrixLib.applyMovingMaxPool(). The cost is added on top of what is already there to any tiles which have a
	 * lower existing cost than the new value. Tiles in overlapping cost-adding windows will have the maximum of the
	 * costs added to their value, not the total of the costs.
	 * -> This method will not always produce the same results as setting the cost first and then smearing!
	 * -> Do not run additional passes of applyMovingMaxPool after doing this!
	 * -> This method assumes that you have already added explicit terrain costs.
	 * Example -----------------------------------------------------------------------------------------------------
	 * Start       AddCost     MaxPool    |    Start       MaxPool     AddCostAfterMaxPooling
	 * 0 0 0 0     0 0 0 0     1 7 7 0    |    0 0 0 0     1 2 2 0     1 7 7 0
	 * 0 1 2 0     0 1 7 0     9 9 7 0    |    0 1 2 0     9 9 2 0     9 9 7 0
	 * 0 9 0 0     0 9 5 0     9 9 5 1    |    0 9 0 0     9 9 1 1     9 9 6 1
	 * 0 0 0 1     0 0 0 1     0 0 1 1    |    0 0 0 1     0 0 1 1     0 0 1 1
	 */
	static addCostAfterMaxPooling(matrix: CostMatrix, positions: (RoomPosition | HasPos)[],
								  width: number, height: number, cost: number): CostMatrix {
		const addMatrix = new PathFinder.CostMatrix();
		MatrixLib.setToMaxCostAfterMaxPooling(addMatrix, positions, width, height, cost);
		MatrixLib.addMatrices(matrix, addMatrix);
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
	static getTerrainMatrix(roomName: string, terrainCosts: TerrainCosts, skipClone = false): CostMatrix {
		const key = `${roomName}_${terrainCosts.plainCost}_${terrainCosts.swampCost}`;
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
		if (skipClone) { // be careful with this!
			return PERMACACHE.terrainMatrices[key];
		}
		return PERMACACHE.terrainMatrices[key].clone();
	}

	/**
	 * Get a cloned copy of the cost matrix for a room with specified options
	 */
	static getSwarmTerrainMatrix(roomName: string, terrainCosts: TerrainCosts, width: number, height: number,
								 exitCost = 10, skipClone = false): CostMatrix {
		const key = `s_${roomName}_${terrainCosts.plainCost}_${terrainCosts.swampCost}_${width}_${height}_${exitCost}`;
		if (PERMACACHE.terrainMatrices[key] === undefined) {
			const terrainMatrix = MatrixLib.getTerrainMatrix(roomName, terrainCosts);
			MatrixLib.setExitCosts(terrainMatrix, roomName, exitCost);
			MatrixLib.applyMovingMaxPool(terrainMatrix, width, height);
			PERMACACHE.terrainMatrices[key] = terrainMatrix;
		}
		if (skipClone) {
			return PERMACACHE.terrainMatrices[key];
		}
		return PERMACACHE.terrainMatrices[key].clone();
	}


	/**
	 * Adds the terrain costs to an existing cost matrix
	 */
	static addTerrainCosts(matrix: CostMatrix, roomName: string, terrainCosts: TerrainCosts): CostMatrix {
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
	 * Sets allied creep positions to impassible
	 */
	static blockAlliedCreeps(matrix: CostMatrix, room: Room) {
		_.forEach(room.friendlies, hostile => {
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
	 * Generates and caches a rampart mask for the room with 0x00 where there are ramparts and 0xff everywhere else.
	 * If onlyMy=true, then only ramparts that are owned by me are counted.
	 * -> This method does not take rampart walkability into account (if there are structures under the rampart)
	 */
	private static getRampartMask(room: Room, onlyMy = true, value = 0xff): CostMatrix {
		const key = `rampartMask_${room.name}_onlymy_${onlyMy}`;

		let matrix: CostMatrix | undefined;
		let expiration: number;
		let invalidateCondition: () => boolean;

		if (MatrixCache[key]) {
			expiration = MatrixCache[key].expiration || Infinity;
			invalidateCondition = MatrixCache[key].invalidateCondition || (() => false);
			if (Game.time >= expiration || invalidateCondition()) {
				delete MatrixCache[key];
				matrix = undefined;
			} else {
				matrix = MatrixCache[key].matrix;
			}
		}

		if (!matrix) {
			matrix = new PathFinder.CostMatrix();
			MatrixLib.fillMatrix(matrix, 0xff);
			const ramparts = onlyMy ? _.filter(room.ramparts, rampart => rampart.my) : room.ramparts;
			for (const rampart of ramparts) {
				matrix.set(rampart.pos.x, rampart.pos.y, 0);
			}
		}

		const numRamparts = room.ramparts.length; // this doesn't account for onlyMy option but I think this is okay
		MatrixCache[key] = {
			matrix             : matrix,
			generated          : Game.time,
			expiration         : Game.time + 100,
			invalidateCondition: () => Game.rooms[room.name] && Game.rooms[room.name].ramparts.length != numRamparts,
		};

		return MatrixCache[key].matrix;
	}

	/**
	 * Sets walkable rampart positions to 1 if cost is less than 0xfe
	 * TODO: maybe increasing cost elsewhere would be better than decreasing cost in ramparts
	 */
	static setWalkableRampartCostToOne(matrix: CostMatrix, room: Room) {
		_.forEach(room.walkableRamparts, rampart => {
			if (matrix.get(rampart.pos.x, rampart.pos.y) < 0xfe) {
				matrix.set(rampart.pos.x, rampart.pos.y, 1);
			}
		});
	}

	/**
	 * Blocks all non-rampart positions in the room. If onlyMy=true, then only my rampart positions are blocked
	 */
	static blockNonRamparts(matrix: CostMatrix, room: Room, onlyMy = true) {
		const mask = MatrixLib.getRampartMask(room, onlyMy);
		MatrixLib.addMatrices(matrix, mask);
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

global.MatrixCache = MatrixCache;
global.MatrixLib = MatrixLib;

