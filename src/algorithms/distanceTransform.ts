/**
 @param {PathFinder.CostMatrix} foregroundPixels - object pixels. modified for output
 @param {number} oob - value used for pixels outside image bounds
 @return {PathFinder.CostMatrix}

 the oob parameter is used so that if an object pixel is at the image boundary
 you can avoid having that reduce the pixel's value in the final output. Set
 it to a high value (e.g., 255) for this. Set oob to 0 to treat out of bounds
 as background pixels.
 */
function distanceTransform(foregroundPixels: CostMatrix, oob = 255): CostMatrix {
	let dist = foregroundPixels; // not a copy. We're modifying the input

	// Variables to represent the 3x3 neighborhood of a pixel.
	let UL, U, UR: number;
	let L, mid, R: number;
	let BL, B, BR: number;

	let x, y, value: number;

	for (y = 0; y < 50; ++y) {
		for (x = 0; x < 50; ++x) {
			if (foregroundPixels.get(x, y) !== 0) {
				UL = dist.get(x - 1, y - 1);
				U = dist.get(x, y - 1);
				UR = dist.get(x + 1, y - 1);
				L = dist.get(x - 1, y);
				if (y == 0) {
					UL = oob;
					U = oob;
					UR = oob;
				}
				if (x == 0) {
					UL = oob;
					L = oob;
				}
				if (x == 49) {
					UR = oob;
				}
				dist.set(x, y, Math.min(UL, U, UR, L, 254) + 1);
			}
		}
	}
	for (y = 49; y >= 0; --y) {
		for (x = 49; x >= 0; --x) {
			mid = dist.get(x, y);
			R = dist.get(x + 1, y);
			BL = dist.get(x - 1, y + 1);
			B = dist.get(x, y + 1);
			BR = dist.get(x + 1, y + 1);
			if (y == 49) {
				BL = oob;
				B = oob;
				BR = oob;
			}
			if (x == 49) {
				R = oob;
				BR = oob;
			}
			if (x == 0) {
				BL = oob;
			}
			value = Math.min(mid, R + 1, BL + 1, B + 1, BR + 1);
			dist.set(x, y, value);
		}
	}
	return dist;
}

// Compute a cost matrix for walkable pixels in a room
function walkablePixelsForRoom(roomName: string): CostMatrix {
	var costMatrix = new PathFinder.CostMatrix();
	for (var y = 0; y < 50; ++y) {
		for (var x = 0; x < 50; ++x) {
			if (Game.map.getTerrainAt(x, y, roomName) != 'wall') {
				costMatrix.set(x, y, 1);
			}
		}
	}
	return costMatrix;
}

function wallOrAdjacentToExit(x: number, y: number, roomName: string): boolean {
	if (1 < x && x < 48 && 1 < y && y < 48) {
		return Game.map.getTerrainAt(x, y, roomName) == 'wall';
	}
	if (0 == x || 0 == y || 49 == x || 49 == y) {
		return true;
	}
	if (Game.map.getTerrainAt(x, y, roomName) == 'wall') {
		return true;
	}
	// If we've reached here then position is a walkable neighbor to an exit tile
	let A, B, C;
	if (x == 1) {
		A = Game.map.getTerrainAt(0, y - 1, roomName);
		B = Game.map.getTerrainAt(0, y, roomName);
		C = Game.map.getTerrainAt(0, y + 1, roomName);
	} else if (x == 48) {
		A = Game.map.getTerrainAt(49, y - 1, roomName);
		B = Game.map.getTerrainAt(49, y, roomName);
		C = Game.map.getTerrainAt(49, y + 1, roomName);
	}
	if (y == 1) {
		A = Game.map.getTerrainAt(x - 1, 0, roomName);
		B = Game.map.getTerrainAt(x, 0, roomName);
		C = Game.map.getTerrainAt(x + 1, 0, roomName);
	} else if (y == 48) {
		A = Game.map.getTerrainAt(x - 1, 49, roomName);
		B = Game.map.getTerrainAt(x, 49, roomName);
		C = Game.map.getTerrainAt(x + 1, 49, roomName);
	}
	return !(A == 'wall' && B == 'wall' && C == 'wall');
}

// Compute positions where you can build movement-blocking structures in a room
function blockablePixelsForRoom(roomName: string): CostMatrix {
	var costMatrix = new PathFinder.CostMatrix();
	for (var y = 0; y < 50; ++y) {
		for (var x = 0; x < 50; ++x) {
			if (!wallOrAdjacentToExit(x, y, roomName)) {
				costMatrix.set(x, y, 1);
			}
		}
	}
	return costMatrix;
}

// Visualize a given costMatrix globally
function displayCostMatrix(costMatrix: CostMatrix, color = '#ff0000'): void {
	var vis = new RoomVisual();

	var max = 1;
	for (var y = 0; y < 50; ++y) {
		for (var x = 0; x < 50; ++x) {
			max = Math.max(max, costMatrix.get(x, y));
		}
	}

	for (var y = 0; y < 50; ++y) {
		for (var x = 0; x < 50; ++x) {
			var value = costMatrix.get(x, y);
			if (value > 0) {
				vis.circle(x, y, {radius: costMatrix.get(x, y) / max / 2, fill: color});
			}
		}
	}
}

export function testDistanceTransform(roomName = 'sim') {
	let dt = distanceTransform(walkablePixelsForRoom(roomName));
	displayCostMatrix(dt);
}
