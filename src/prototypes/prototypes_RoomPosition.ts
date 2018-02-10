Object.defineProperty(RoomPosition.prototype, 'name', { // identifier for the room position, used in caching
	get: function () {
		return this.roomName + ':' + this.x + ':' + this.y;
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

// Object.defineProperty(RoomPosition.prototype, 'adjacentSpots', {
// 	get: function () {
// 		return spots;
// 	}
// });

RoomPosition.prototype.isPassible = function (ignoreCreeps = false): boolean {
	// Is terrain passable?
	if (Game.map.getTerrainAt(this) == 'wall') return false;
	if (this.isVisible) {
		// Are there creeps?
		if (ignoreCreeps == false && this.lookFor(LOOK_CREEPS).length > 0) return false;
		// Are there structures?
		if (_.filter(this.lookFor(LOOK_STRUCTURES), (s: Structure) => s.isPassible).length > 0) return false;
	}
	return true;
};

RoomPosition.prototype.availableNeighbors = function (ignoreCreeps = false): RoomPosition[] {
	return _.filter(this.neighbors, pos => pos.isPassible(ignoreCreeps));
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

RoomPosition.prototype.findClosestByMultiRoomRange =
	function <T extends _HasRoomPosition>(objects: T[], opts?: { filter: any | string; }): T {
		let distances = _.map(objects, obj => this.getMultiRoomRangeTo(obj.pos));
		let minDistance = Infinity;
		let i = 0;
		let minIndex = 0;
		for (let distance of distances) {
			if (distance < minDistance) {
				minDistance = distance;
				minIndex = i;
			}
			i++;
		}
		return objects[minIndex];
	};

