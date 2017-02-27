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

// determines if object is in same room as other object in possibly undefined room
RoomObject.prototype.inSameRoomAs = function (otherObject) {
    return this.pos.inRangeTo(otherObject, 50);
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

Object.defineProperty(RoomObject.prototype, 'ref', { // reference object; see globals.deref (which includes Creep)
    get: function () {
        return this.id || this.name || null;
    }
});

Object.defineProperty(RoomObject.prototype, 'flagged', { // if the object has a flag
    get: function () {
        return this.pos.flagged;
    }
});

RoomObject.prototype.flaggedWith = function (filter) { // if the object has a certain type of flag
    return this.pos.flaggedWith(filter);
};

// List of creeps assigned to this object
Object.defineProperty(RoomObject.prototype, 'assignedCreeps', {
    get: function () {
        return _.filter(Game.creeps, creep => creep.memory.assignment && creep.memory.assignment == this.ref);
    }
});

// List of creeps with tasks targeting this object
Object.defineProperty(RoomObject.prototype, 'targetedBy', {
    get: function () {
        return _.filter(this.room.creeps, creep => creep.task && creep.task.target == this);
    }
});

// If an object has a nearby link
Object.defineProperty(RoomObject.prototype, 'linked', {
    get: function () {
        return this.pos.findInRange(FIND_MY_STRUCTURES, 3, {
            filter: (s) => s.structureType == STRUCTURE_LINK
        }).length > 0;
    }
});

// All links that are near an object
Object.defineProperty(RoomObject.prototype, 'links', {
    get: function () {
        return this.pos.findInRange(FIND_MY_STRUCTURES, 3, {filter: (s) => s.structureType == STRUCTURE_LINK});
    }
});

Object.defineProperty(RoomObject.prototype, 'pathLengthToStorage', { // find and cache a path length to storage
    get () {
        if (!this.room.memory.storagePathLengths) {
            this.room.memory.storagePathLengths = {}
        }
        if (!this.room.memory.storagePathLengths[this.ref]) {
            this.room.memory.storagePathLengths[this.ref] = PathFinder.search(this.room.storage.pos,
                                                                              this.pos).path.length
        }
        return this.room.memory.storagePathLengths[this.ref];
    }
});
