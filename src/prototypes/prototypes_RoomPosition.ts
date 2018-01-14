Object.defineProperty(RoomPosition.prototype, 'name', { // identifier for the room position, used in caching
	get: function () {
		return this.roomName + ':' + this.x + ':' + this.y;
	},
});

Object.defineProperty(RoomPosition.prototype, 'isEdge', { // if the position is at the edge of a room
	get: function () {
		return this.x == 0 || this.x == 49 || this.y == 0 || this.y == 49;
	},
});

Object.defineProperty(RoomPosition.prototype, 'rangeToEdge', { // range to the nearest room edge
	get: function () {
		return _.min([this.x, 49 - this.x, this.y, 49 - this.y]);
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

// RoomPosition.prototype.findClosestByMultiRoomRange = function <T extends _HasRoomPosition |
// 	RoomPosition>(objects: T[] | RoomPosition[], opts?: { filter: any | string; }): T {
// 	let distances = _.map(objects, obj => this.getMultiRoomRangeTo(obj.pos?obj.pos : obj));
// 	let minDistance = Infinity;
// 	let i = 0;
// 	let minIndex = 0;
// 	for (let distance of distances) {
// 		if (distance < minDistance) {
// 			minDistance = distance;
// 			minIndex = i;
// 		}
// 		i++;
// 	}
// 	return objects[i];
// };

