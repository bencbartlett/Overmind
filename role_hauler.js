// Hauler - brings back energy from reserved outposts

var roleHauler = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        var maxSize = 7; // maximum number of CARRY-CARRY-MOVE pushes
        var energy = spawn.room.energyCapacityAvailable; // total energy available for spawn + extensions
        var numberOfParts = Math.floor((energy - (50 + 50)) / 100); // max number of work parts you can put on
        numberOfParts = Math.min(numberOfParts, maxSize);
        // make sure the creep is not too big (more than 50 parts)
        numberOfParts = Math.min(numberOfParts, 50 - 2); // don't exceed max parts
        var body = [];
        for (let i = 0; i < numberOfParts; i++) {
            body.push(CARRY);
            body.push(CARRY);
            body.push(MOVE);
        }
        body.push(WORK);
        body.push(MOVE);
        return spawn.createCreep(body, spawn.creepName('hauler'), {role: 'hauler', origin: spawn.room.name});
    },

    getAssignment: function (creep) {
        var untargetedFlags = _.filter(Game.flags, (f) => f.color == COLOR_YELLOW &&
                                                          f.isTargeted('hauler').length < 2);
        if (untargetedFlags.length > 0) {
            // var controller = untargetedFlags[0].room.controller;
            creep.memory.assignment = untargetedFlags[0].name;
            console.log(creep.name + " assigned to: " + untargetedFlags[0].name);
        } else {
            console.log(creep.name + " could not receive an assignment.");
        }
    },

    collectMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit mode (working = true) if done
            var origin = Game.rooms[creep.memory.origin];
            if (origin.storage) {
                creep.memory.working = true;
                creep.memory.target = origin.storage.id;
                creep.say("Storing!");
                this.depositMode(creep);
            } else {
                console.log(creep.name + ": no storage in origin room!");
            }
        } else {
            if (!creep.memory.target) {
                creep.targetFlaggedContainer(Game.flags[creep.memory.assignment]);
            }
            creep.goWithdraw(null); // no retargeting
        }
    },

    depositMode: function (creep) {
        if (creep.carry.energy == 0) {// Switch to collect mode (working = false) when out of energy
            var assignedFlag = Game.flags[creep.memory.assignment];
            if (creep.targetFlaggedContainer(assignedFlag) == OK) {
                creep.memory.working = false;
                creep.say("Collecting!");
                this.collectMode(creep);
            } else {
                console.log(creep.name + ": error targeting flagged container!");
            }
        } else {
            var origin = Game.rooms[creep.memory.origin];
            if (origin.storage) {
                var res = creep.goTransfer(null); // no retargeting
            } else {
                console.log(creep.name + ": no storage in origin room!");
            }
        }
    },

    run: function (creep) {
        // Get an assignment if you don't have one already
        if (!creep.memory.assignment) {
            this.getAssignment(creep);
        }
        // Haul energy back from extension
        if (creep.memory.working) {
            this.depositMode(creep);
        } else {
            this.collectMode(creep);
        }
    }
};

module.exports = roleHauler;