/* tslint:disable:no-bitwise prefer-for-of */

import {log} from '../console/log';
import {normalizePos} from '../movement/helpers';
import {TerrainCosts} from '../movement/Pathing';
import {profile} from '../profiler/decorator';

// export interface RoomCostMatrix extends CostMatrix {
// 	room: Room;
// }

PERMACACHE.terrainMatrices = PERMACACHE.terrainMatrices || {};

/**
 * MatrixLib contains an assortment of CostMatrix-related manipulation functions. I use C-style loops in most of this
 * library because even though they are ugly af, they are significantly (~20x!) faster than _.forEach or
 * for (const thing of things) { } loops.
 */
@profile
export class MatrixLib {

	/**
	 * Adds two matrices in-place on the first matrix. This method modifies the first matrix and does not modify the
	 * second matrix. This method accesses the non-api CostMatrix._bits property so it may break in the future if they
	 * modify the mechanics of cost matrices. See this file for details:
	 * https://github.com/screeps/engine/blob/master/src/game/path-finder.js
	 */
	static addMatrices(matrixToModify: CostMatrix, addCosts: CostMatrix): void {
		for (let i = 0; i < 2500; i++) {
			matrixToModify._bits[i] = Math.min(Math.max(0, matrixToModify._bits[i] + addCosts._bits[i]), 255);
		}
	}


	/**
	 * Blocks all specified positions, setting their cost to 0xff
	 */
	static block(matrix: CostMatrix, positions: RoomPosition[]): void {
		for (let i = 0; i < positions.length; i++) {
			matrix.set(positions[i].x, positions[i].y, 0xff);
		}
	}


	/**
	 * Sets impassible structure positions to 0xff
	 */
	static blockImpassibleStructures(matrix: CostMatrix, room: Room): void {
		const impassibleStuctures = _.filter(room.find(FIND_STRUCTURES), (s: Structure) => !s.isWalkable);
		const blockPositions = _.map(impassibleStuctures, s => s.pos);
		MatrixLib.block(matrix, blockPositions);
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
							   includeTerrain = true, terrainCosts: TerrainCosts = {plainCost: 1, swampCost: 5}): void {

		if (Math.floor(maxCost / range) != maxCost / range) {
			log.error(`MatrixLib.addPyramidPotential: maxCost must be divisible by (range+1)!`);
			return;
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

				r = Math.max(Math.abs(dx), Math.abs(dy));
				cost += slope * (range + 1 - r);
				matrix.set(x, y, cost); // cost can exceed 0xff since it is min-maxed in backend
			}
		}
	}


	/**
	 * Adds a square potential with a specified center and range. If includeTerrainCosts=true (by default) then if the
	 * cost for a square is zero, the terrain cost of the tile is added using default costs of {plain: 1, swamp: 5}.
	 */
	static addSquarePotential(matrix: CostMatrix, pos: RoomPosition | HasPos, range: number, addCost: number,
							  includeTerrain = true, terrainCosts: TerrainCosts = {plainCost: 1, swampCost: 5}) {

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

	/**
	 * Sets the cost of all walkable positions within range of a target position or object. If add=true, adds the cost
	 * to the existing cost of the tile. If the cost for a square is zero, the terrain cost of the tile is added
	 * using implicit costs of {plain: 1, swamp: 5}
	 */
	static setInRange(matrix: CostMatrix, pos: RoomPosition | HasPos, range: number, cost: number, add = false) {

		pos = normalizePos(pos);
		const terrain = Game.map.getRoomTerrain(pos.roomName);

		let x, y, dx, dy, currentCost: number;
		for (dx = -range; dx <= range; dx++) {
			x = pos.x + dx;
			if (x < 0 || x > 49) continue;
			for (dy = -range; dy <= range; dy++) {
				y = pos.y + dy;
				if (y < 0 || y > 49) continue;
				if (terrain.get(x, y) & TERRAIN_MASK_WALL) {
					continue;
				}
				currentCost = matrix.get(x, y);
				if (currentCost === 0) {
					if (terrain.get(x, y) & TERRAIN_MASK_SWAMP) {
						currentCost += 10;
					} else {
						currentCost += 2;
					}
				}
				// if (currentCost >= 0xff || currentCost > cost) continue; // not necessary, done in backend
				matrix.set(x, y, add ? cost + currentCost : cost);
			}
		}
	}

	/**
	 * Get a matrix of explicit terrain cost values for a room given specified movement costs. The matrix is stored
	 * in the permacache and a cloned matrix is returned which you may modify.
	 */
	static getTerrainMatrix(roomName: string, terrainCosts: TerrainCosts = {plainCost: 1, swampCost: 5}): CostMatrix {
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
		return PERMACACHE.terrainMatrices[key].clone();
	}


	/**
	 * Adds the terrain costs to an existing cost matrix
	 */
	static addTerrainCosts(matrix: CostMatrix, roomName: string,
						   terrainCosts: TerrainCosts = {plainCost: 1, swampCost: 5}): void {
		const terrainMatrix = MatrixLib.getTerrainMatrix(roomName, terrainCosts);
		MatrixLib.addMatrices(matrix, terrainMatrix);
	}


	/**
	 * Blocks all tiles at the edge of the room. If rangeToEdge is specified, block all tiles within that range of
	 * the edge.
	 */
	static blockExits(matrix: CostMatrix, rangeToEdge = 0): void {
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

	/**
	 * Sets the cost of all walkable tiles at the edge of the room. If rangeToEdge is specified, set the cost of
	 * all walkable terrain tiles within that range of the edge.
	 */
	static setExitCosts(matrix: CostMatrix, roomName: string, cost: number, rangeToEdge = 0): void {
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
	}

}



