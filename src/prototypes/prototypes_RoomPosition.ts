Object.defineProperty(RoomPosition.prototype, 'name', { // identifier for the room position, used in caching
    get: function () {
        return this.roomName + ":" + this.x + ":" + this.y;
    }
});

Object.defineProperty(RoomPosition.prototype, 'flagged', { // if the object has a flag
    get: function () {
        return this.lookFor(LOOK_FLAGS).length > 0;
    }
});

RoomPosition.prototype.flaggedWith = function (filter) { // if the object has a certain type of flag
    return _.filter(this.lookFor(LOOK_FLAGS), filter).length > 0;
};

// Get an estimate for the distance to another room position in a possibly different room
RoomPosition.prototype.getMultiRoomRangeTo = function (pos: RoomPosition): number {
    if (this.roomName == pos.roomName) {
        return this.getRangeTo(pos);
    } else {
        return 50* Game.map.getRoomLinearDistance(this.roomName, pos.roomName);
    }
};
