/**
 * Code for calculating the minCut in a room, written by Saruss,
 * adapted for Typescript and flexible room subsets by Chobobobo,
 * modified and debugged by Muon.
 */
import {log} from '../console/log';

const UNWALKABLE = -10;
const RANGE_MODIFIER = 1; // this parameter sets the scaling of weights to prefer walls closer protection bounds
const RANGE_PADDING = 3; // max range to reduce weighting; RANGE_MODIFIER * RANGE_PADDING must be < PROTECTED
const NORMAL = 0;
const PROTECTED = 10;
const CANNOT_BUILD = 20;
const EXIT = 30;

/**
 * @property {number} capacity - The flow capacity of this edge
 * @property {number} flow - The current flow of this edge
 * @property {number} resEdge -
 * @property {number} to - where this edge leads to
 */
export interface Edge {
	capacity: number;
	flow: number;
	resEdge: number;
	to: number;
}

/**
 * @property {number} x1 - Top left corner
 * @property {number} x1 - Top left corner
 * @property {number} x2 - Bottom right corner
 * @property {number} y2 - Bottom right corner
 */
export interface Rectangle {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export class Graph {
	totalVertices: number;
	level: number[];
	edges: { [from: number]: Edge[] };

	constructor(totalVertices: number) {
		this.totalVertices = totalVertices;
		this.level = Array(totalVertices);
		// An array of edges for each vertex
		this.edges = Array(totalVertices).fill(0).map((x) => []);
	}

	/**
	 * Create a new edge in the graph as well as a corresponding reverse edge on the residual graph
	 * @param from - vertex edge starts at
	 * @param to - vertex edge leads to
	 * @param capacity - max flow capacity for this edge
	 */
	newEdge(from: number, to: number, capacity: number) {
		// Normal forward Edge
		this.edges[from].push({to, resEdge: this.edges[to].length, capacity, flow: 0});
		// reverse Edge for Residual Graph
		this.edges[to].push({to: from, resEdge: this.edges[from].length - 1, capacity: 0, flow: 0});
	}

	/**
	 * Uses Breadth First Search to see if a path exists to the vertex 'to' and generate the level graph
	 * @param from - vertex to start from
	 * @param to - vertex to try and reach
	 */
	createLevelGraph(from: number, to: number) {
		if (to >= this.totalVertices) {
			return false;
		}
		this.level.fill(-1); // reset old levels
		this.level[from] = 0;
		const q = []; // queue with s as starting point
		q.push(from);
		let u = 0;
		let edge = null;
		while (q.length) {
			u = q.shift()!;
			for (edge of this.edges[u]) {
				if (this.level[edge.to] < 0 && edge.flow < edge.capacity) {
					this.level[edge.to] = this.level[u] + 1;
					q.push(edge.to);
				}
			}
		}
		return this.level[to] >= 0; // return if theres a path, no level, no path!
	}

	/**
	 * Depth First Search-like: send flow at along path from from->to recursively while increasing the level of the
	 * visited vertices by one
	 * @param start - the vertex to start at
	 * @param end - the vertex to try and reach
	 * @param targetFlow - the amount of flow to try and achieve
	 * @param count - keep track of which vertices have been visited so we don't include them twice
	 */
	calcFlow(start: number, end: number, targetFlow: number, count: number[]) {
		if (start === end) { // Sink reached , abort recursion
			return targetFlow;
		}
		let edge: Edge;
		let flowTillHere = 0;
		let flowToT = 0;
		while (count[start] < this.edges[start].length) { // Visit all edges of the vertex one after the other
			edge = this.edges[start][count[start]];
			if (this.level[edge.to] === this.level[start] + 1 && edge.flow < edge.capacity) {
				// Edge leads to Vertex with a level one higher, and has flow left
				flowTillHere = Math.min(targetFlow, edge.capacity - edge.flow);
				flowToT = this.calcFlow(edge.to, end, flowTillHere, count);
				if (flowToT > 0) {
					edge.flow += flowToT; // Add Flow to current edge
					// subtract from reverse Edge -> Residual Graph neg. Flow to use backward direction of BFS/DFS
					this.edges[edge.to][edge.resEdge].flow -= flowToT;
					return flowToT;
				}
			}
			count[start]++;
		}
		return 0;
	}

	/**
	 * Uses Breadth First Search to find the vertices in the minCut for the graph
	 * - Must call calcMinCut first to prepare the graph
	 * @param from - the vertex to start from
	 */
	getMinCut(from: number) {
		const eInCut = [];
		this.level.fill(-1);
		this.level[from] = 1;
		const q = [];
		q.push(from);
		let u = 0;
		let edge: Edge;
		while (q.length) {
			u = q.shift()!;
			for (edge of this.edges[u]) {
				if (edge.flow < edge.capacity) {
					if (this.level[edge.to] < 1) {
						this.level[edge.to] = 1;
						q.push(edge.to);
					}
				}
				if (edge.flow === edge.capacity && edge.capacity > 0) { // blocking edge -> could be in min cut
					eInCut.push({to: edge.to, unreachable: u});
				}
			}
		}

		const minCut = [];
		let cutEdge: { to: number, unreachable: number };
		for (cutEdge of eInCut) {
			if (this.level[cutEdge.to] === -1) {
				// Only edges which are blocking and lead to the sink from unreachable vertices are in the min cut
				minCut.push(cutEdge.unreachable);
			}
		}
		return minCut;
	}

	/**
	 * Calculates min-cut graph using Dinic's Algorithm.
	 * use getMinCut to get the actual verticies in the minCut
	 * @param source - Source vertex
	 * @param sink - Sink vertex
	 */
	calcMinCut(source: number, sink: number) {
		if (source === sink) {
			return -1;
		}
		let ret = 0;
		let count = [];
		let flow = 0;
		while (this.createLevelGraph(source, sink)) {
			count = Array(this.totalVertices + 1).fill(0);
			do {
				flow = this.calcFlow(source, sink, Number.MAX_VALUE, count);
				if (flow > 0) {
					ret += flow;
				}
			} while (flow);
		}
		return ret;
	}
}

/**
 * An Array with Terrain information: -1 not usable, 2 Sink (Leads to Exit)
 * @param room - the room to generate the terrain map from
 */
export function get2DArray(roomName: string, bounds: Rectangle = {x1: 0, y1: 0, x2: 49, y2: 49}) {

	const room2D = Array(50).fill(NORMAL).map((d) => Array(50).fill(NORMAL)); // Array for room tiles
	let x: number;
	let y: number;

	const terrain = Game.map.getRoomTerrain(roomName);

	for (x = bounds.x1; x <= bounds.x2; x++) {
		for (y = bounds.y1; y <= bounds.y2; y++) {
			if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
				room2D[x][y] = UNWALKABLE; // Mark unwalkable
			} else if (x === bounds.x1 || y === bounds.y1 || x === bounds.x2 || y === bounds.y2) {
				room2D[x][y] = EXIT; // Mark exit tiles
			}
		}
	}

	// Marks tiles as unbuildable if they are proximate to exits
	for (y = bounds.y1 + 1; y <= bounds.y2 - 1; y++) {
		if (room2D[bounds.x1][y] === EXIT) {
			for (const dy of [-1, 0, 1]) {
				if (room2D[bounds.x1 + 1][y + dy] !== UNWALKABLE) {
					room2D[bounds.x1 + 1][y + dy] = CANNOT_BUILD;
				}
			}
		}
		if (room2D[bounds.x2][y] === EXIT) {
			for (const dy of [-1, 0, 1]) {
				if (room2D[bounds.x2 - 1][y + dy] !== UNWALKABLE) {
					room2D[bounds.x2 - 1][y + dy] = CANNOT_BUILD;
				}
			}
		}
	}
	for (x = bounds.x1 + 1; x <= bounds.x2 - 1; x++) {
		if (room2D[x][bounds.y1] === EXIT) {
			for (const dx of [-1, 0, 1]) {
				if (room2D[x + dx][bounds.y1 + 1] !== UNWALKABLE) {
					room2D[x + dx][bounds.y1 + 1] = CANNOT_BUILD;
				}
			}
		}
		if (room2D[x][bounds.y2] === EXIT) {
			for (const dx of [-1, 0, 1]) {
				if (room2D[x + dx][bounds.y2 - 1] !== UNWALKABLE) {
					room2D[x + dx][bounds.y2 - 1] = CANNOT_BUILD;
				}
			}
		}
	}

	return room2D;
}

/**
 * Function to create Source, Sink, Tiles arrays: takes a rectangle-Array as input for Tiles that are to Protect
 * @param room - the room to consider
 * @param toProtect - the coordinates to protect inside the walls
 * @param bounds - the area to consider for the minCut
 */
export function createGraph(roomName: string, toProtect: Rectangle[],
							preferCloserBarriers     = true,
							preferCloserBarrierLimit = Infinity, // ignore the toProtect[n] for n > this value
							visualize                = true,
							bounds: Rectangle        = {x1: 0, y1: 0, x2: 49, y2: 49}) {
	const visual = new RoomVisual(roomName);
	const roomArray = get2DArray(roomName, bounds);
	// For all Rectangles, set edges as source (to protect area) and area as unused
	let r: Rectangle;
	let x: number;
	let y: number;
	for (r of toProtect) {
		if (bounds.x1 >= bounds.x2 || bounds.y1 >= bounds.y2 ||
			bounds.x1 < 0 || bounds.y1 < 0 || bounds.x2 > 49 || bounds.y2 > 49) {
			return console.log('ERROR: Invalid bounds', JSON.stringify(bounds));
		} else if (r.x1 >= r.x2 || r.y1 >= r.y2) {
			return console.log('ERROR: Rectangle', JSON.stringify(r), 'invalid.');
		} else if (r.x1 < bounds.x1 || r.x2 > bounds.x2 || r.y1 < bounds.y1 || r.y2 > bounds.y2) {
			return console.log('ERROR: Rectangle', JSON.stringify(r), 'out of bounds:', JSON.stringify(bounds));
		}
		for (x = r.x1; x <= r.x2; x++) {
			for (y = r.y1; y <= r.y2; y++) {
				if (x === r.x1 || x === r.x2 || y === r.y1 || y === r.y2) {
					if (roomArray[x][y] === NORMAL) {
						roomArray[x][y] = PROTECTED;
					}
				} else {
					roomArray[x][y] = UNWALKABLE;
				}
			}
		}
	}
	// Preferentially weight closer tiles
	if (preferCloserBarriers) {
		for (r of _.take(toProtect, preferCloserBarrierLimit)) {
			const [xmin, xmax] = [Math.max(r.x1 - RANGE_PADDING, 0), Math.min(r.x2 + RANGE_PADDING, 49)];
			const [ymin, ymax] = [Math.max(r.y1 - RANGE_PADDING, 0), Math.min(r.y2 + RANGE_PADDING, 49)];
			for (x = xmin; x <= xmax; x++) {
				for (y = ymin; y <= ymax; y++) {
					if (roomArray[x][y] >= NORMAL && roomArray[x][y] < PROTECTED) {
						const x1range = Math.max(r.x1 - x, 0);
						const x2range = Math.max(x - r.x2, 0);
						const y1range = Math.max(r.y1 - y, 0);
						const y2range = Math.max(y - r.y2, 0);
						const rangeToBorder = Math.max(x1range, x2range, y1range, y2range);
						const modifiedWeight = NORMAL + RANGE_MODIFIER * (RANGE_PADDING - rangeToBorder);
						roomArray[x][y] = Math.max(roomArray[x][y], modifiedWeight);
						if (visualize) {
							visual.text(`${roomArray[x][y]}`, x, y);
						}
					}
				}
			}
		}
	}

	// ********************** Visualization
	if (visualize) {
		for (x = bounds.x1; x <= bounds.x2; x++) {
			for (y = bounds.y1; y <= bounds.y2; y++) {
				if (roomArray[x][y] === UNWALKABLE) {
					visual.circle(x, y, {radius: 0.5, fill: '#1b1b9f', opacity: 0.3});
				} else if (roomArray[x][y] > UNWALKABLE && roomArray[x][y] < NORMAL) {
					visual.circle(x, y, {radius: 0.5, fill: '#42cce8', opacity: 0.3});
				} else if (roomArray[x][y] === NORMAL) {
					visual.circle(x, y, {radius: 0.5, fill: '#bdb8b8', opacity: 0.3});
				} else if (roomArray[x][y] > NORMAL && roomArray[x][y] < PROTECTED) {
					visual.circle(x, y, {radius: 0.5, fill: '#9929e8', opacity: 0.3});
				} else if (roomArray[x][y] === PROTECTED) {
					visual.circle(x, y, {radius: 0.5, fill: '#e800c6', opacity: 0.3});
				} else if (roomArray[x][y] === CANNOT_BUILD) {
					visual.circle(x, y, {radius: 0.5, fill: '#e8000f', opacity: 0.3});
				} else if (roomArray[x][y] === EXIT) {
					visual.circle(x, y, {radius: 0.5, fill: '#000000', opacity: 0.3});
				}
			}
		}
	}

	// initialise graph
	// possible 2*50*50 +2 (st) Vertices (Walls etc set to unused later)
	const g = new Graph(2 * 50 * 50 + 2);
	const infini = Number.MAX_VALUE;
	const surr = [[0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1]];
	// per Tile (0 in Array) top + bot with edge of c=1 from top to bott  (use every tile once!)
	// infini edge from bot to top vertices of adjacent tiles if they not protected (array =1)
	// (no reverse edges in normal graph)
	// per prot. Tile (1 in array) Edge from source to this tile with infini cap.
	// per exit Tile (2in array) Edge to sink with infini cap.
	// source is at  pos 2*50*50, sink at 2*50*50+1 as first tile is 0,0 => pos 0
	// top vertices <-> x,y : v=y*50+x   and x= v % 50  y=v/50 (math.floor?)
	// bot vertices <-> top + 2500
	const source = 2 * 50 * 50;
	const sink = 2 * 50 * 50 + 1;
	let top = 0;
	let bot = 0;
	let dx = 0;
	let dy = 0;
	// max = 49;
	const baseCapacity = 10;
	const modifyWeight = preferCloserBarriers ? 1 : 0;
	for (x = bounds.x1 + 1; x < bounds.x2; x++) {
		for (y = bounds.y1 + 1; y < bounds.y2; y++) {
			top = y * 50 + x;
			bot = top + 2500;
			if (roomArray[x][y] >= NORMAL && roomArray[x][y] <= PROTECTED) {
				if (roomArray[x][y] >= NORMAL && roomArray[x][y] < PROTECTED) {
					g.newEdge(top, bot, baseCapacity - modifyWeight * roomArray[x][y]); // add surplus weighting
				} else if (roomArray[x][y] === PROTECTED) { // connect this to the source
					g.newEdge(source, top, infini);
					g.newEdge(top, bot, baseCapacity - modifyWeight * RANGE_PADDING * RANGE_MODIFIER);
				}
				for (let i = 0; i < 8; i++) { // attach adjacent edges
					dx = x + surr[i][0];
					dy = y + surr[i][1];
					if ((roomArray[dx][dy] >= NORMAL && roomArray[dx][dy] < PROTECTED)
						|| roomArray[dx][dy] === CANNOT_BUILD) {
						g.newEdge(bot, dy * 50 + dx, infini);
					}
				}
			} else if (roomArray[x][y] === CANNOT_BUILD) { // near Exit
				g.newEdge(top, sink, infini);
			}
		}
	} // graph finished
	return g;
}

/**
 * Main function to be called by user: calculate min cut tiles from room using rectangles as protected areas
 * @param room - the room to use
 * @param rectangles - the areas to protect, defined as rectangles
 * @param bounds - the area to be considered for the minCut
 */
export function getCutTiles(roomName: string, toProtect: Rectangle[],
							preferCloserBarriers     = true,
							preferCloserBarrierLimit = Infinity,
							visualize                = true,
							bounds: Rectangle        = {x1: 0, y1: 0, x2: 49, y2: 49}): Coord[] {
	const graph = createGraph(roomName, toProtect, preferCloserBarriers, preferCloserBarrierLimit, visualize, bounds);
	if (!graph) {
		return [];
	}
	let x: number;
	let y: number;
	const source = 2 * 50 * 50; // Position Source / Sink in Room-Graph
	const sink = 2 * 50 * 50 + 1;
	const count = graph.calcMinCut(source, sink);
	// console.log('Number of Tiles in Cut:', count);
	const positions = [];
	if (count > 0) {
		const cutVertices = graph.getMinCut(source);
		let v: number;
		for (v of cutVertices) {
			// x= vertex % 50  y=v/50 (math.floor?)
			x = v % 50;
			y = Math.floor(v / 50);
			positions.push({x, y});
		}
	}
	// Visualise Result
	if (positions.length > 0) {
		const visual = new RoomVisual(roomName);
		for (let i = positions.length - 1; i >= 0; i--) {
			visual.circle(positions[i].x, positions[i].y, {radius: 0.5, fill: '#ff7722', opacity: 0.9});
		}
	} else {
		return [];
	}
	const wholeRoom = bounds.x1 === 0 && bounds.y1 === 0 && bounds.x2 === 49 && bounds.y2 === 49;
	return wholeRoom ? positions : pruneDeadEnds(roomName, positions);
}

/**
 * Removes unnecessary tiles if they are blocking the path to a dead end
 * Useful if minCut has been run on a subset of the room
 * @param roomName - Room to work in
 * @param cutTiles - Array of tiles which are in the minCut
 */
export function pruneDeadEnds(roomName: string, cutTiles: Coord[]) {
	// Get Terrain and set all cut-tiles as unwalkable
	const roomArray = get2DArray(roomName);
	let tile: Coord;
	for (tile of cutTiles) {
		roomArray[tile.x][tile.y] = UNWALKABLE;
	}
	// Floodfill from exits: save exit tiles in array and do a BFS-like search
	const unvisited: number[] = [];
	let y: number;
	let x: number;
	for (y = 0; y < 49; y++) {
		if (roomArray[0][y] === EXIT) {
			console.log('prune: toExit', 0, y);
			unvisited.push(50 * y);
		}
		if (roomArray[49][y] === EXIT) {
			console.log('prune: toExit', 49, y);
			unvisited.push(50 * y + 49);
		}
	}
	for (x = 0; x < 49; x++) {
		if (roomArray[x][0] === EXIT) {
			console.log('prune: toExit', x, 0);
			unvisited.push(x);
		}
		if (roomArray[x][49] === EXIT) {
			console.log('prune: toExit', x, 49);
			unvisited.push(2450 + x); // 50*49=2450
		}
	}
	// Iterate over all unvisited EXIT tiles and mark neigbours as EXIT tiles if walkable, add to unvisited
	const surr = [[0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1]];
	let currPos: number;
	let dx: number;
	let dy: number;
	while (unvisited.length > 0) {
		currPos = unvisited.pop()!;
		x = currPos % 50;
		y = Math.floor(currPos / 50);
		for (let i = 0; i < 8; i++) {
			dx = x + surr[i][0];
			dy = y + surr[i][1];
			if (dx < 0 || dx > 49 || dy < 0 || dy > 49) {
				continue;
			}
			if ((roomArray[dx][dy] >= NORMAL && roomArray[dx][dy] < PROTECTED)
				|| roomArray[dx][dy] === CANNOT_BUILD) {
				unvisited.push(50 * dy + dx);
				roomArray[dx][dy] = EXIT;
			}
		}
	}
	// Remove min-Cut-Tile if there is no EXIT reachable by it
	let leadsToExit: boolean;
	const validCut: Coord[] = [];
	for (tile of cutTiles) {
		leadsToExit = false;
		for (let j = 0; j < 8; j++) {
			dx = tile.x + surr[j][0];
			dy = tile.y + surr[j][1];
			if (roomArray[dx][dy] === EXIT) {
				leadsToExit = true;
			}
		}
		if (leadsToExit) {
			validCut.push(tile);
		}
	}
	return validCut;
}

/**
 * Example function: demonstrates how to get a min cut with 2 rectangles, which define a "to protect" area
 * @param roomName - the name of the room to use for the test, must be visible
 */
export function testMinCut(colonyName: string, preferCloserBarriers = true) {
	const colony = Overmind.colonies[colonyName];
	if (!colony) {
		return `No colony: ${colonyName}`;
	}
	let cpu = Game.cpu.getUsed();
	// Rectangle Array, the Rectangles will be protected by the returned tiles
	const rectArray = [];
	const padding = 3;
	if (colony.hatchery) {
		const {x, y} = colony.hatchery.pos;
		const [x1, y1] = [Math.max(x - 5 - padding, 0), Math.max(y - 4 - padding, 0)];
		const [x2, y2] = [Math.min(x + 5 + padding, 49), Math.min(y + 6 + padding, 49)];
		rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
	}
	if (colony.commandCenter) {
		const {x, y} = colony.commandCenter.pos;
		const [x1, y1] = [Math.max(x - 3 - padding, 0), Math.max(y - 0 - padding, 0)];
		const [x2, y2] = [Math.min(x + 0 + padding, 49), Math.min(y + 5 + padding, 49)];
		rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
	}
	if (colony.upgradeSite) {
		const {x, y} = colony.upgradeSite.pos;
		const [x1, y1] = [Math.max(x - 1, 0), Math.max(y - 1, 0)];
		const [x2, y2] = [Math.min(x + 1, 49), Math.min(y + 1, 49)];
		rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
	}
	// Get Min cut
	// Positions is an array where to build walls/ramparts
	const positions = getCutTiles(colonyName, rectArray, preferCloserBarriers, 2);
	// Test output
	// console.log('Positions returned', positions.length);
	cpu = Game.cpu.getUsed() - cpu;
	// console.log('Needed', cpu, ' cpu time');
	log.info(`preferCloserBarriers = ${preferCloserBarriers}; positions returned: ${positions.length};` +
			 ` CPU time: ${cpu}`);
	return 'Finished';
}

/**
 * Example function: demonstrates how to get a min cut with 2 rectangles, which define a "to protect" area
 * while considering a subset of the larger room.
 * @param roomName - the name of the room to use for the test, must be visible
 */
export function testMinCutSubset(colonyName: string) {
	const colony = Overmind.colonies[colonyName];
	if (!colony) {
		return `No colony: ${colonyName}`;
	}
	let cpu = Game.cpu.getUsed();
	// Rectangle Array, the Rectangles will be protected by the returned tiles
	const rectArray = [];
	const padding = 3;
	if (colony.hatchery) {
		const {x, y} = colony.hatchery.pos;
		rectArray.push({x1: x - 5 - padding, y1: y - 4 - padding, x2: x + 5 + padding, y2: y + 6 + padding});
	}
	if (colony.commandCenter) {
		const {x, y} = colony.commandCenter.pos;
		rectArray.push({x1: x - 3 - padding, y1: y - 0 - padding, x2: x + 0 + padding, y2: y + 5 + padding});
	}
	// Get Min cut, returns the positions where ramparts/walls need to be
	const positions = getCutTiles(colonyName, rectArray, true, Infinity, true,
								  {x1: 5, y1: 5, x2: 44, y2: 44});
	// Test output
	console.log('Positions returned', positions.length);
	cpu = Game.cpu.getUsed() - cpu;
	console.log('Needed', cpu, ' cpu time');
	return 'Finished';
}
