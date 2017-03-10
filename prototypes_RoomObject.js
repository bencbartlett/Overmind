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

RoomObject.prototype.log = function (message) {
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

// RoomObject.prototype.getAssignedCreeps = function (roleName) {
//     return _.filter(this.assignedCreeps, creep => creep.memory.role == roleName &&
//                                                   (!creep.memory.data.replaceAt ||
//                                                    creep.ticksToLive > creep.memory.data.replaceAt));
// };

// Object of creeps assigned to this roomObject with keys as roles
Object.defineProperty(RoomObject.prototype, 'assignedCreeps', {
    get: function () {
        if (Memory.preprocessing.assignments[this.ref]) {
            return Memory.preprocessing.assignments[this.ref];
        } else {
            // return _.groupBy(_.filter(Game.creeps, creep => creep.memory.assignment &&
            //                                                 creep.memory.assignment == this.ref),
            //                  creep => creep.memory.role);
            return {};
        }
    }
});

RoomObject.prototype.getAssignedCreepAmounts = function (role) {
    let amount = this.assignedCreepAmounts[role];
    return amount || 0
};

// Object of number of creeps assigned to this roomObject with keys as roles
// Object.defineProperty(RoomObject.prototype, 'assignedCreepAmounts', {
//     get: function () {
//         let assignedCreeps =  _.filter(Game.creeps, creep => creep.memory.assignment &&
//                                                              creep.memory.assignment == this.ref);
//         return _.mapValues(_.groupBy(assignedCreeps, creep => creep.memory.role), creepList => creepList.length);
//     }
// });

Object.defineProperty(RoomObject.prototype, 'assignedCreepAmounts', {
    get: function () {
        if (Memory.preprocessing.assignments[this.ref]) {
            return _.mapValues(Memory.preprocessing.assignments[this.ref], creepList => creepList.length);
        } else {
            // console.log("Regenerating assigned creep amounts! (Why?)");
            let assignedCreeps = _.filter(Game.creeps, creep => creep.memory.assignment &&
                                                                creep.memory.assignment == this.ref);
            return _.mapValues(_.groupBy(assignedCreeps, creep => creep.memory.role), creepList => creepList.length);
        }
    }
});

// List of creeps with tasks targeting this object
Object.defineProperty(RoomObject.prototype, 'targetedBy', {
    get: function () {
        // return _.filter(Game.creeps, creep => creep.memory.task && creep.memory.task.targetID == this.ref);
        return Memory.preprocessing.targets[this.ref] || [];
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

// RoomObject.prototype.pathLengthTo = function (roomObj) {
//     if (!this.room.memory.pathLengths) {
//         this.room.memory.pathLengths = {}
//     }
//     if (!this.room.memory.pathLengths[this.ref]) {
//         this.room.memory.pathLengths
//     }
//     if (!this.room.memory.pathLengths[roomObj.ref]) {
//         this.room.memory.pathLengths[roomObj.ref] = require('pathing').findPathLengthIncludingRoads(roomObj.pos,
//                                                                                                     this.pos);
//     }
//     return this.room.memory.pathLengths[roomObj.ref];
// };

Object.defineProperty(RoomObject.prototype, 'roomName', {
    get: function () {
        return this.pos.roomName;
    }
});
