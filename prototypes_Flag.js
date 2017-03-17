// Flag prototypes

var flagCodes = require('map_flag_codes');
var roles = require('roles');

// Flag assignment =====================================================================================================

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

Object.defineProperty(Flag.prototype, 'assignedRoom', { // the room the flag is assigned to
    get () {
        if (!this.memory.assignedRoom) {
            return null;
        } else {
            return Game.rooms[this.memory.assignedRoom];
        }
    }
});


// Flags for labs and minerals =========================================================================================

Flag.prototype.setMineral = function (mineralType) {
    if (flagCodes.minerals.filter(this)) {
        let validResources = require('map_resources');
        if (_.includes(validResources, mineralType)) {
            this.memory.mineralType = mineralType;
            console.log(this.name + " now instructs lab to contain " + this.memory.mineralType + ".");
            return OK;
        } else {
            console.log(this.name + ": " + mineralType + " is not a valid RESOURCE_*.");
        }
    } else {
        console.log(this.name + " is not a mineral flag.");
    }
};

Object.defineProperty(Flag.prototype, 'IO', { // should the lab be loaded or unloaded?
    get () {
        return this.memory.IO;
    },
    set (inOrOut) {
        if (!(inOrOut == 'in' || inOrOut == 'out')) {
            console.log('IO must be "in" or "out".');
        } else {
            this.memory.IO = inOrOut;
        }
    }
});


// Flag code properties ================================================================================================

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

Flag.prototype.action = function (...args) {
    return this.type.action(this, ...args); // calls flag action with this as flag argument
};


// Assigned creep indexing =============================================================================================

Flag.prototype.getAssignedCreepAmounts = function (role) {
    let amount = this.assignedCreepAmounts[role];
    return amount || 0
};

Object.defineProperty(Flag.prototype, 'assignedCreepAmounts', {
    get: function () {
        if (Memory.preprocessing.assignments[this.ref]) {
            let creepNamesByRole = Memory.preprocessing.assignments[this.ref];
            for (let role in creepNamesByRole) { // only include creeps that shouldn't be replaced yet
                creepNamesByRole[role] = _.filter(creepNamesByRole[role],
                                                  name => Game.creeps[name].needsReplacing == false)
            }
            this.memory.assignedCreepAmounts = _.mapValues(creepNamesByRole, creepList => creepList.length);
        } else {
            this.memory.assignedCreepAmounts = {};
        }
        return this.memory.assignedCreepAmounts;
    }
});

Flag.prototype.getRequiredCreepAmounts = function (role) {
    let amount = this.requiredCreepAmounts[role];
    return amount || 0;
};

Object.defineProperty(Flag.prototype, 'requiredCreepAmounts', { // roles as keys and required amounts as values
    get () {
        if (!this.memory.requiredCreepAmounts) {
            return this.memory.requiredCreepAmounts = {};
        }
        return this.memory.requiredCreepAmounts;
    }
});


// Spawning requests ===================================================================================================

Flag.prototype.needsAdditional = function (role) { // if the flag needs more of a certain type of creep
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


// Path length caching =================================================================================================

Object.defineProperty(Flag.prototype, 'pathLengthToAssignedRoomStorage', {
    get () {
        if (!this.memory.pathLengthToAssignedRoomStorage) {
            this.memory.pathLengthToAssignedRoomStorage =
                require('pathing').findPathLengthIncludingRoads(this.assignedRoom.storage.pos, this.pos)
        }
        return this.memory.pathLengthToAssignedRoomStorage;
    }
});

Object.defineProperty(Flag.prototype, 'haulingNeeded', { // total amount of energy*distance/tick of hauling needed
    get () {
        var sourceEnergy;
        if (this.room) {
            sourceEnergy = this.pos.lookFor(LOOK_SOURCES)[0].energyCapacity;
        } else {
            sourceEnergy = 3000;
        }
        let energyPerTick = sourceEnergy / 300; // avg amount of energy generated per tick
        let ticksPerHaul = 2 * this.pathLengthToAssignedRoomStorage; // distance (# of ticks) to haul energy back
        let haulingPower = energyPerTick * ticksPerHaul; // (energy/tick) * (ticks/1cap haul) = total capacity needs
        if ((haulingPower * 3/2 + 150) / 1500 > sourceEnergy / 300) { // check if hauling is profitable
            console.log("Warning: it is not profitable to harvest from " + this.name +
                        " given the current assigned room location");
        }
        return haulingPower;
    }
});

