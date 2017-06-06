Object.defineProperty(RoomPosition.prototype, 'name', { // identifier for the room position, used in caching
	get: function () {
		return this.roomName + ':' + this.x + ':' + this.y;
	},
});

Object.defineProperty(RoomPosition.prototype, 'flagged', { // if the object has a flag
	get: function () {
		return this.lookFor(LOOK_FLAGS).length > 0;
	},
});

Object.defineProperty(RoomPosition.prototype, 'isEdge', { // if the position is at the edge of a room
	get: function () {
		return this.x == 0 || this.x == 49 || this.y == 0 || this.y == 49;
	},
});

RoomPosition.prototype.getAdjacentPositions = function () {
	let adjPos: RoomPosition[] = [];
	for (let dx of [-1, 0, 1]) {
		for (let dy of [-1, 0, 1]) {
			if (!(dx == 0 && dy == 0)) {
				adjPos.push(new RoomPosition(this.x + dx, this.y + dy, this.roomName));
			}
		}
	}
	return adjPos;
};

RoomPosition.prototype.flaggedWith = function (filter) { // if the object has a certain type of flag
	return _.filter(this.lookFor(LOOK_FLAGS), filter).length > 0;
};

// Get an estimate for the distance to another room position in a possibly different room
RoomPosition.prototype.getMultiRoomRangeTo = function (pos: RoomPosition): number {
	if (this.roomName == pos.roomName) {
		return this.getRangeTo(pos);
	} else {
		return 50 * Game.map.getRoomLinearDistance(this.roomName, pos.roomName);
	}
};

RoomPosition.prototype.findClosestByLimitedRange = function <T>(objects: T[] | RoomPosition[], rangeLimit: number,
																opts?: { filter: any | string; }): T {
	let objectsInRange = this.findInRange(objects, rangeLimit, opts);
	return this.findClosestByRange(objectsInRange);
};

