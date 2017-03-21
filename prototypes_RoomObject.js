// RoomObject prototypes

RoomObject.prototype.log = function (message) {
    console.log(this.room.name + ' ' + this.name + ': "' + message + '"');
};

// determines if object is in same room as other object in possibly undefined room
RoomObject.prototype.inSameRoomAs = function (otherObject) {
    return this.pos.inRangeTo(otherObject, 50);
};

Object.defineProperty(RoomObject.prototype, 'ref', { // reference object; see globals.deref (which includes Creep)
    get: function () {
        return this.id || this.name || null;
    }
});


// Assigned and targeted creep indexing ================================================================================

Object.defineProperty(RoomObject.prototype, 'assignedCreepNames', { // keys: roles, values: names
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

RoomObject.prototype.getAssignedCreeps = function (role) {
    let creepNames = this.assignedCreepNames[role];
    return _.filter(_.map(creepNames, name => Game.creeps[name]), creep => creep.needsReplacing == false);
};

RoomObject.prototype.getAssignedCreepAmounts = function (role) {
    let amount = this.getAssignedCreeps(role).length;
    return amount || 0
};

Object.defineProperty(RoomObject.prototype, 'assignedCreepAmounts', {
    get: function () {
        if (Memory.preprocessing.assignments[this.ref]) {
            let creepNamesByRole = Memory.preprocessing.assignments[this.ref];
            for (let role in creepNamesByRole) { // only include creeps that shouldn't be replaced yet
                creepNamesByRole[role] = _.filter(creepNamesByRole[role],
                                                  name => Game.creeps[name].needsReplacing == false)
            }
            return _.mapValues(creepNamesByRole, creepList => creepList.length);
        } else {
            console.log("Regenerating assigned creep amounts! (Why?)");
            let assignedCreeps = _.filter(Game.creeps,
                                          creep => creep.memory.assignment &&
                                                   creep.memory.assignment == this.ref &&
                                                   creep.needsReplacing == false);
            return _.mapValues(_.groupBy(assignedCreeps, creep => creep.memory.role), creepList => creepList.length);
        }
    }
});

Object.defineProperty(RoomObject.prototype, 'targetedBy', { // List of creep names with tasks targeting this object
    get: function () {
        return Memory.preprocessing.targets[this.ref] || [];
    }
});


// Flag association ====================================================================================================

Object.defineProperty(RoomObject.prototype, 'flagged', { // if the object has a flag
    get: function () {
        return this.pos.flagged;
    }
});

RoomObject.prototype.flaggedWith = function (filter) { // if the object has a certain type of flag
    return this.pos.flaggedWith(filter);
};


// Link association ====================================================================================================

Object.defineProperty(RoomObject.prototype, 'linked', { // If an object has a nearby link
    get: function () {
        return this.pos.findInRange(FIND_MY_STRUCTURES, 3, {
                filter: (s) => s.structureType == STRUCTURE_LINK
            }).length > 0;
    }
});

Object.defineProperty(RoomObject.prototype, 'links', { // All links that are near an object
    get: function () {
        return this.pos.findInRange(FIND_MY_STRUCTURES, 3, {filter: (s) => s.structureType == STRUCTURE_LINK});
    }
});


// Path length caching =================================================================================================

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
