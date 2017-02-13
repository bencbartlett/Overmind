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
        creeps = _.filter(Game.creeps, (creep) => creep.memory.role == role);
    } else {
        creeps = Game.creeps;
    }
    if (this.hasOwnProperty('id')) {
        creeps = _.filter(creeps, (creep) => creep.memory.target == this.id); // only ones targeting this object
    } else if (this.hasOwnProperty('name')) {
        creeps = _.filter(creeps, (creep) => creep.memory.target == this.name); // only ones targeting this object
    } else {
        console.log(this + " does not have a name or ID.");
        return false;
    }
    return creeps; // return list of targeting creeps
};