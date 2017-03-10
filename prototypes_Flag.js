var flagCodes = require('map_flag_codes');
var roles = require('roles');



Flag.prototype.assign = function (roomName) {
    if (Game.rooms[roomName] && Game.rooms[roomName].my) {
        this.memory.assignedRoom = roomName;
        console.log(this.name + " now assigned to room " + this.memory.assignedRoom + ".");
        return OK;
    } else {
        console.log(roomName + " is not a valid owned room!");
    }
};

Flag.prototype.unassign = function () {
    console.log(this.name + " now unassigned from " + this.memory.assignedRoom + ".");
    delete this.memory.assignedRoom;
    return OK;
};

Object.defineProperty(Flag.prototype, 'category', { // the category object in flagCodes map
    get () {
        return _.find(flagCodes, cat => cat.color == this.color);
    }
});

Object.defineProperty(Flag.prototype, 'type', { // subcategory object
    get () {
        return _.find(this.category, type => type.secondaryColor == this.secondaryColor);
    }
});

Object.defineProperty(Flag.prototype, 'assignedRoom', { // the room the flag is assigned to
    get () {
        if (!this.memory.assignedRoom) {
            return null;
        } else {
            return Game.rooms[this.memory.assignedRoom];
        }
    }
});

Flag.prototype.getAssignedCreepAmounts = function (role) {
    let amount = this.assignedCreepAmounts[role];
    return amount || 0
};

Object.defineProperty(Flag.prototype, 'assignedCreepAmounts', {
    get: function () {
        if (Memory.preprocessing.assignments[this.ref]) {
            this.memory.assignedCreepAmounts = _.mapValues(Memory.preprocessing.assignments[this.ref],
                                                           creepList => creepList.length);
        } else {
            // console.log(this.name + " regenerating flag mem!");
            // let assignedCreeps = _.filter(Game.creeps, creep => creep.memory.assignment &&
            //                                                     creep.memory.assignment == this.ref);
            // this.memory.assignedCreepAmounts = _.mapValues(_.groupBy(assignedCreeps, creep => creep.memory.role),
            //                                                creepList => creepList.length);
            this.memory.assignedCreepAmounts = {};
        }
        return this.memory.assignedCreepAmounts;
    }
});

Flag.prototype.getRequiredCreepAmounts = function (role) {
    let amount = this.requiredCreepAmounts[role];
    return amount || 0;
};

// an object with roles as keys and required amounts as values
Object.defineProperty(Flag.prototype, 'requiredCreepAmounts', {
    get () {
        if (!this.memory.requiredCreepAmounts) {
            return this.memory.requiredCreepAmounts = {};
        }
        return this.memory.requiredCreepAmounts;
    }
});

// if the flag needs more of a certain type of creep
Flag.prototype.needsAdditional = function (role) {
    return this.getAssignedCreepAmounts(role) < this.getRequiredCreepAmounts(role);
};

Flag.prototype.requestCreepIfNeeded = function (brain, role,
    {assignment = this, workRoom = this.roomName, patternRepetitionLimit = Infinity}) {
    if (this.needsAdditional(role)) {
        return roles(role).create(brain.spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: patternRepetitionLimit
        });
    } else {
        return null;
    }
};

Object.defineProperty(Flag.prototype, 'pathLengthToAssignedRoomStorage', {
    get () {
        if (!this.memory.pathLengthToAssignedRoomStorage) {
            this.memory.pathLengthToAssignedRoomStorage =
                require('pathing').findPathLengthIncludingRoads(this.assignedRoom.storage.pos, this.pos)
        }
        return this.memory.pathLengthToAssignedRoomStorage;
    }
});

Flag.prototype.action = function (...args) {
    return this.type.action(this, ...args); // calls flag action with this as flag argument
};

