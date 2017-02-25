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

RoomObject.prototype.log = function(message) {
    console.log(this.room.name + ' ' + this.name + ': "' + message + '"');
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

Object.defineProperty(RoomObject.prototype, 'ref', { // identifier property. id preferred over name over null
    get: function () {
        return this.id || this.name || null;
    }
});

// List of creeps assigned to this object
Object.defineProperty(RoomObject.prototype, 'assignedCreeps', { // TODO: fine for small numbers of creeps, might rewrite
    get: function () {
        return _.filter(Game.creeps, creep => creep.memory.assignment && creep.memory.assignment == this.id);
    }
});

// List of creeps with tasks targeting this object
Object.defineProperty(RoomObject.prototype, 'targetedBy', { // TODO: fine for small numbers of creeps, might rewrite
    get: function () {
        return _.filter(this.room.creeps, creep => creep.task && creep.task.target == this);
    }
});

// List of creeps assigned to this object
// TODO: deprecated?
Object.defineProperty(RoomObject.prototype, 'taskedCreeps', {
    get: function () {
        return _.filter(Game.creeps, creep => creep.task &&
                                              creep.task.target &&
                                              creep.task.target == this.id);
    }
});