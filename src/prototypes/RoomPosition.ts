import {minBy} from '../utilities/utils';

Object.defineProperty(RoomPosition.prototype, 'print', {
	get() {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.roomName + '">[' + this.roomName + ', ' + this.x + ', ' + this.y + ']</a>';
	}
});

Object.defineProperty(RoomPosition.prototype, 'printPlain', {
	get() {
		return `[${this.roomName}, ${this.x}, ${this.y}]`;
	}
});

Object.defineProperty(RoomPosition.prototype, 'room', { // identifier for the pos, used in caching
	get: function () {
		return Game.rooms[this.roomName];
	},
});

Object.defineProperty(RoomPosition.prototype, 'name', { // identifier for the pos, used in caching
	get: function () {
		return this.roomName + ':' + this.x + ':' + this.y;
	},
});

Object.defineProperty(RoomPosition.prototype, 'coordName', { // name, but without the roomName
	get: function () {
		return this.x + ':' + this.y;
	},
});

RoomPosition.prototype.lookForStructure = function (structureType: StructureConstant): Structure | undefined {
	return _.find(this.lookFor(LOOK_STRUCTURES), s => s.structureType == structureType);
};

Object.defineProperty(RoomPosition.prototype, 'isEdge', { // if the position is at the edge of a room
	get: function () {
		return this.x == 0 || this.x == 49 || this.y == 0 || this.y == 49;
	},
});

Object.defineProperty(RoomPosition.prototype, 'isVisible', { // if the position is in a defined room
	get: function () {
		return Game.rooms[this.roomName] != undefined;
	},
});

Object.defineProperty(RoomPosition.prototype, 'rangeToEdge', { // range to the nearest room edge
	get: function () {
		return _.min([this.x, 49 - this.x, this.y, 49 - this.y]);
	},
});

Object.defineProperty(RoomPosition.prototype, 'roomCoords', {
	get: function () {
		let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(this.roomName);
		let x = parseInt(parsed![1], 10);
		let y = parseInt(parsed![2], 10);
		if (this.roomName.includes('W')) x = -x;
		if (this.roomName.includes('N')) y = -y;
		return {x: x, y: y} as Coord;
	},
});

Object.defineProperty(RoomPosition.prototype, 'neighbors', {
	get: function () {
		let adjPos: RoomPosition[] = [];
		for (let dx of [-1, 0, 1]) {
			for (let dy of [-1, 0, 1]) {
				if (!(dx == 0 && dy == 0)) {
					let x = this.x + dx;
					let y = this.y + dy;
					if (0 < x && x < 49 && 0 < y && y < 49) {
						adjPos.push(new RoomPosition(x, y, this.roomName));
					}
				}
			}
		}
		return adjPos;
	}
});

RoomPosition.prototype.getPositionsInRange = function (range: number,
													   includeWalls = false, includeEdges = false): RoomPosition[] {
	let adjPos: RoomPosition[] = [];
	let [xmin, xmax] = includeEdges ? [0, 49] : [1, 48];
	let [ymin, ymax] = includeEdges ? [0, 49] : [1, 48];
	for (let dx = -1 * range; dx <= range; dx++) {
		for (let dy = -1 * range; dy <= range; dy++) {
			let x = this.x + dx;
			let y = this.y + dy;
			if (xmin <= x && x <= xmax && xmin <= y && y <= xmax) {
				if (includeWalls || Game.map.getTerrainAt(x, y, this.roomName) != 'wall') {
					adjPos.push(new RoomPosition(x, y, this.roomName));
				}
			}
		}
	}
	return adjPos;
};

RoomPosition.prototype.getPositionsAtRange = function (range: number,
													   includeWalls = false, includeEdges = false): RoomPosition[] {
	let adjPos: RoomPosition[] = [];
	let [xmin, xmax] = includeEdges ? [0, 49] : [1, 48];
	let [ymin, ymax] = includeEdges ? [0, 49] : [1, 48];
	for (let dx = -1 * range; dx <= range; dx++) {
		for (let dy = -1 * range; dy <= range; dy++) {
			if (Math.max(dx, dy) < range) {
				continue;
			}
			let x = this.x + dx;
			let y = this.y + dy;
			if (xmin <= x && x <= xmax && xmin <= y && y <= xmax) {
				if (includeWalls || Game.map.getTerrainAt(x, y, this.roomName) != 'wall') {
					adjPos.push(new RoomPosition(x, y, this.roomName));
				}
			}
		}
	}
	return adjPos;
};

// Object.defineProperty(RoomPosition.prototype, 'adjacentSpots', {
// 	get: function () {
// 		return spots;
// 	}
// });

RoomPosition.prototype.isWalkable = function (ignoreCreeps = false): boolean {
	// Is terrain passable?
	if (Game.map.getTerrainAt(this) == 'wall') return false;
	if (this.isVisible) {
		// Are there creeps?
		if (ignoreCreeps == false && this.lookFor(LOOK_CREEPS).length > 0) return false;
		// Are there structures?
		if (_.filter(this.lookFor(LOOK_STRUCTURES), (s: Structure) => !s.isWalkable).length > 0) return false;
	}
	return true;
};

RoomPosition.prototype.availableNeighbors = function (ignoreCreeps = false): RoomPosition[] {
	return _.filter(this.neighbors, pos => pos.isWalkable(ignoreCreeps));
};

RoomPosition.prototype.getPositionAtDirection = function (direction: DirectionConstant, range = 1): RoomPosition {
	let x = this.x;
	let y = this.y;
	switch (direction) {
		case 1:
			y -= range;
			break;
		case 2:
			y -= range;
			x += range;
			break;
		case 3:
			x += range;
			break;
		case 4:
			x += range;
			y += range;
			break;
		case 5:
			y += range;
			break;
		case 6:
			y += range;
			x -= range;
			break;
		case 7:
			x -= range;
			break;
		case 8:
			x -= range;
			y -= range;
			break;
	}
	return new RoomPosition(x, y, this.roomName);
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
RoomPosition.prototype.getMultiRoomRangeTo = function (pos: RoomPosition): number {
	if (this.roomName == pos.roomName) {
		return this.getRangeTo(pos);
	} else {
		let from = this.roomCoords;
		let to = pos.roomCoords;
		let dx = Math.abs(50 * (to.x - from.x) + pos.x - this.x);
		let dy = Math.abs(50 * (to.y - from.y) + pos.y - this.y);
		return _.max([dx, dy]);
	}
};

RoomPosition.prototype.findClosestByLimitedRange = function <T>(objects: T[] | RoomPosition[], rangeLimit: number,
																opts?: { filter: any | string; }): T {
	let objectsInRange = this.findInRange(objects, rangeLimit, opts);
	return this.findClosestByRange(objectsInRange, opts);
};

RoomPosition.prototype.findClosestByMultiRoomRange = function <T extends _HasRoomPosition>(objects: T[]): T {
	return minBy(objects, (obj: T) => this.getMultiRoomRangeTo(obj.pos));
};

// This should only be used within a single room
RoomPosition.prototype.findClosestByRangeThenPath = function <T extends _HasRoomPosition>(objects: T[]): T {
	let distances = _.map(objects, obj => this.getRangeTo(obj));
	let minDistance = _.min(distances);
	if (minDistance > 4) {
		return this.findClosestByRange(objects);
	} else {
		let closestObjects = _.filter(objects, obj => this.getRangeTo(obj) == minDistance);
		return this.findClosestByPath(closestObjects); // don't clutter up pathing.distance cached values
	}
};

