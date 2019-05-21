import {Cartographer} from '../utilities/Cartographer';
import {minBy, mod} from '../utilities/utils';

Object.defineProperty(RoomPosition.prototype, 'print', {
	get() {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.roomName + '">[' + this.roomName + ', ' + this.x +
			   ', ' + this.y + ']</a>';
	},
	configurable: true,
});

Object.defineProperty(RoomPosition.prototype, 'printPlain', {
	get() {
		return `[${this.roomName}, ${this.x}, ${this.y}]`;
	},
	configurable: true,
});

Object.defineProperty(RoomPosition.prototype, 'room', { // identifier for the pos, used in caching
	get         : function() {
		return Game.rooms[this.roomName];
	},
	configurable: true,
});

Object.defineProperty(RoomPosition.prototype, 'name', { // identifier for the pos, used in caching
	get         : function() {
		return this.roomName + ':' + this.x + ':' + this.y;
	},
	configurable: true,
});

Object.defineProperty(RoomPosition.prototype, 'coordName', { // name, but without the roomName
	get         : function() {
		return this.x + ':' + this.y;
	},
	configurable: true,
});

RoomPosition.prototype.lookForStructure = function(structureType: StructureConstant): Structure | undefined {
	return _.find(this.lookFor(LOOK_STRUCTURES), s => s.structureType === structureType);
};

RoomPosition.prototype.getOffsetPos = function(dx: number, dy: number): RoomPosition {
	let roomName = this.roomName;
	let x = this.x + dx;
	if (x < 0 || x > 49) {
		const dxRoom = Math.floor(x / 50);
		x = mod(x, 50);
		roomName = Cartographer.findRelativeRoomName(roomName, dxRoom, 0);
	}
	let y = this.y + dy;
	if (y < 0 || y > 49) {
		const dyRoom = Math.floor(y / 50);
		y = mod(y, 50);
		roomName = Cartographer.findRelativeRoomName(roomName, 0, dyRoom);
	}
	return new RoomPosition(x, y, roomName);
};

// RoomPosition.prototype.findInRange_fast = function<T extends HasPos>(objects: T[], range: number): T[] {
// 	return _.filter(objects, o => this.inRangeToXY(o.pos.x, o.pos.y, range));
// }

Object.defineProperty(RoomPosition.prototype, 'isEdge', { // if the position is at the edge of a room
	get         : function() {
		return this.x === 0 || this.x === 49 || this.y === 0 || this.y === 49;
	},
	configurable: true,
});

Object.defineProperty(RoomPosition.prototype, 'isVisible', { // if the position is in a defined room
	get         : function() {
		return Game.rooms[this.roomName] != undefined;
	},
	configurable: true,
});

Object.defineProperty(RoomPosition.prototype, 'rangeToEdge', { // range to the nearest room edge
	get         : function() {
		return _.min([this.x, 49 - this.x, this.y, 49 - this.y]);
	},
	configurable: true,
});

Object.defineProperty(RoomPosition.prototype, 'roomCoords', {
	get         : function() {
		const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(this.roomName);
		let x = parseInt(parsed![1], 10);
		let y = parseInt(parsed![2], 10);
		if (this.roomName.includes('W')) x = -x;
		if (this.roomName.includes('N')) y = -y;
		return {x: x, y: y} as Coord;
	},
	configurable: true,
});

Object.defineProperty(RoomPosition.prototype, 'neighbors', {
	get         : function() {
		const adjPos: RoomPosition[] = [];
		for (const dx of [-1, 0, 1]) {
			for (const dy of [-1, 0, 1]) {
				if (!(dx == 0 && dy == 0)) {
					const x = this.x + dx;
					const y = this.y + dy;
					if (0 < x && x < 49 && 0 < y && y < 49) {
						adjPos.push(new RoomPosition(x, y, this.roomName));
					}
				}
			}
		}
		return adjPos;
	},
	configurable: true,
});

RoomPosition.prototype.inRangeToPos = function(pos: RoomPosition, range: number): boolean {
	return this.roomName === pos.roomName &&
		   ((pos.x - this.x) < 0 ? (this.x - pos.x) : (pos.x - this.x)) <= range &&
		   ((pos.y - this.y) < 0 ? (this.y - pos.y) : (pos.y - this.y)) <= range;
};

RoomPosition.prototype.inRangeToXY = function(x: number, y: number, range: number) {
	return ((x - this.x) < 0 ? (this.x - x) : (x - this.x)) <= range
		   && ((y - this.y) < 0 ? (this.y - y) : (y - this.y)) <= range;
};

RoomPosition.prototype.getRangeToXY = function(x: number, y: number) {
	return Math.max((x - this.x) < 0 ? (this.x - x) : (x - this.x), ((y - this.y) < 0 ? (this.y - y) : (y - this.y)));
};

RoomPosition.prototype.getPositionsInRange = function(range: number,
													  includeWalls = false, includeEdges = false): RoomPosition[] {
	const terrain = Game.map.getRoomTerrain(this.roomName);

	const adjPos: RoomPosition[] = [];
	const [xmin, xmax] = includeEdges ? [0, 49] : [1, 48];
	const [ymin, ymax] = includeEdges ? [0, 49] : [1, 48];
	for (let dx = -1 * range; dx <= range; dx++) {
		for (let dy = -1 * range; dy <= range; dy++) {
			const x = this.x + dx;
			const y = this.y + dy;
			if (xmin <= x && x <= xmax && xmin <= y && y <= xmax) {
				if (includeWalls || terrain.get(x, y) !== TERRAIN_MASK_WALL) {
					adjPos.push(new RoomPosition(x, y, this.roomName));
				}
			}
		}
	}
	return adjPos;
};

RoomPosition.prototype.getPositionsAtRange = function(range: number,
													  includeWalls = false, includeEdges = false): RoomPosition[] {
	const terrain = Game.map.getRoomTerrain(this.roomName);
	const adjPos: RoomPosition[] = [];
	const [xmin, xmax] = includeEdges ? [0, 49] : [1, 48];
	const [ymin, ymax] = includeEdges ? [0, 49] : [1, 48];
	for (let dx = -1 * range; dx <= range; dx++) {
		for (let dy = -1 * range; dy <= range; dy++) {
			if (Math.max(Math.abs(dx), Math.abs(dy)) < range) {
				continue;
			}
			const x = this.x + dx;
			const y = this.y + dy;
			if (xmin <= x && x <= xmax && xmin <= y && y <= xmax) {
				if (includeWalls || terrain.get(x, y) !== TERRAIN_MASK_WALL) {
					adjPos.push(new RoomPosition(x, y, this.roomName));
				}
			}
		}
	}
	return adjPos;
};

RoomPosition.prototype.isWalkable = function(ignoreCreeps = false): boolean {
	// Is terrain passable?
	if (Game.map.getRoomTerrain(this.roomName).get(this.x, this.y) == TERRAIN_MASK_WALL) return false;
	if (this.isVisible) {
		// Are there creeps?
		if (ignoreCreeps == false && this.lookFor(LOOK_CREEPS).length > 0) return false;
		// Are there structures?
		if (_.filter(this.lookFor(LOOK_STRUCTURES), (s: Structure) => !s.isWalkable).length > 0) return false;
	}
	return true;
};

RoomPosition.prototype.availableNeighbors = function(ignoreCreeps = false): RoomPosition[] {
	return _.filter(this.neighbors, pos => pos.isWalkable(ignoreCreeps));
};

RoomPosition.prototype.getPositionAtDirection = function(direction: DirectionConstant, range = 1): RoomPosition {
	let dx = 0;
	let dy = 0;
	switch (direction) {
		case 1:
			dy = -range;
			break;
		case 2:
			dy = -range;
			dx = range;
			break;
		case 3:
			dx = range;
			break;
		case 4:
			dx = range;
			dy = range;
			break;
		case 5:
			dy = range;
			break;
		case 6:
			dy = range;
			dx = -range;
			break;
		case 7:
			dx = -range;
			break;
		case 8:
			dx = -range;
			dy = -range;
			break;
	}
	return this.getOffsetPos(dx, dy);
};


// Object.defineProperty(RoomPosition.prototype, 'availableAdjacentSpots', {
// 	get: function () {
// 		if (this.isVisible) {
// 			let spots: RoomPosition[] = [];
// 			for (let spot of this.adjacentSpots) {
// 				let structures = this.look;
// 				if (Game.map.getTerrainAt(neighbor) != 'wall') {
// 					// Doesn't include constructed walls
// 					spots.push(neighbor);
// 				}
// 			}
// 			return spots;
// 		} else {
// 			return this.adjacentSpots; // Assume there's nothing there
// 		}
// 	}
// });

// Get an estimate for the distance to another room position in a possibly different room
RoomPosition.prototype.getMultiRoomRangeTo = function(pos: RoomPosition): number {
	if (this.roomName == pos.roomName) {
		return this.getRangeTo(pos);
	} else {
		const from = this.roomCoords;
		const to = pos.roomCoords;
		const dx = Math.abs(50 * (to.x - from.x) + pos.x - this.x);
		const dy = Math.abs(50 * (to.y - from.y) + pos.y - this.y);
		return _.max([dx, dy]);
	}
};

RoomPosition.prototype.findClosestByLimitedRange = function <T>(objects: T[] | RoomPosition[], rangeLimit: number,
																opts?: { filter: any | string; }): T | undefined {
	const objectsInRange = this.findInRange(objects, rangeLimit, opts);
	return this.findClosestByRange(objectsInRange, opts);
};

RoomPosition.prototype.findClosestByMultiRoomRange = function <T extends _HasRoomPosition>(objects: T[]):
	T | undefined {
	return minBy(objects, (obj: T) => this.getMultiRoomRangeTo(obj.pos));
};

// This should only be used within a single room
RoomPosition.prototype.findClosestByRangeThenPath = function <T extends _HasRoomPosition>(objects: T[]): T {
	const distances = _.map(objects, obj => this.getRangeTo(obj));
	const minDistance = _.min(distances);
	if (minDistance > 4) {
		return this.findClosestByRange(objects);
	} else {
		const closestObjects = _.filter(objects, obj => this.getRangeTo(obj) == minDistance);
		return this.findClosestByPath(closestObjects); // don't clutter up pathing.distance cached values
	}
};

