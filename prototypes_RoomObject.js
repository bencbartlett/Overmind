RoomObject.prototype.countAdjacentWalls = function () {
    // Count the number of adjacent walls near an object, not including the terrain of the object.
    // Be careful using this method on objects in the corner of the room!
    var x = this.pos.x;
    var y = this.pos.y;
    var wallCount = 0;
    var nearby = this.room.lookForAtArea(LOOK_TERRAIN, y - 1, x - 1, y + 1, x + 1, true);
    nearby.forEach(function (pos) {
        if (pos.terrain == 'wall' && !(pos.x == x && pos.y == y)) {
            wallCount += 1;
        }
    });
    return wallCount;
};

RoomObject.prototype.capacity = function () {
    return 8 - this.countAdjacentWalls();
};

RoomObject.prototype.openSpots = function () {
    return this.capacity() - this.countAdjacentCreeps();
};

RoomObject.prototype.countAdjacentCreeps = function () {
    return this.pos.findInRange(FIND_CREEPS, 1).length;
};

RoomObject.prototype.isTargeted = function (role = undefined) {
    var creeps;
    if (role != undefined) {
        creeps = _.filter(Game.creeps, (creep) => creep.role() == role);
    } else {
        creeps = Game.creeps;
    }
    for (let name in creeps) {
        if (creeps[name].memory.target == this.id) {
            return creeps[name].id; // return id of first creep found to be targeting this object
        }
    }
    return false;
};