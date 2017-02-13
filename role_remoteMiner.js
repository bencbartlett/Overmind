// Remote miner - mines in a reserved room and handles construction jobs
var roleRemoteMiner = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        var maxWorkParts = 4; // maximum number of WORK parts to put on the creep
        var energy = spawn.room.energyCapacityAvailable; // total energy available for spawn + extensions
        var numberOfParts = Math.floor((energy - (50 + 50)) / 100); // max number of work parts you can put on
        numberOfParts = Math.min(numberOfParts, maxWorkParts);
        // make sure the creep is not too big (more than 50 parts)
        numberOfParts = Math.min(numberOfParts, 50 - 2); // don't exceed max parts
        var body = [];
        for (let i = 0; i < numberOfParts; i++) {
            body.push(WORK);
        }
        body.push(CARRY);
        body.push(CARRY);
        body.push(MOVE);
        body.push(MOVE);
        body.push(MOVE);
        return spawn.createCreep(body, spawn.creepName('remoteMiner'), {role: 'remoteMiner'});
    },

    getAssignment: function (creep) {
        var untargetedFlags = _.filter(Game.flags, (f) => f.color == COLOR_YELLOW &&
                                                          f.isTargeted('remoteMiner').length < 2);
        if (untargetedFlags.length > 0) {
            // var controller = untargetedFlags[0].room.controller;
            creep.memory.assignment = untargetedFlags[0].name;
            console.log(creep.name + " assigned to: " + untargetedFlags[0].name);
        } else {
            console.log(creep.name + " could not receive an assignment.");
        }
    },

    mineMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to build or deposit mode when done
            creep.memory.working = false;
            this.depositBuildMode(creep, true)
        } else {
            var assignment = Game.flags[creep.memory.assignment].pos.lookFor(LOOK_SOURCES)[0];
            if (creep.harvest(assignment) == ERR_NOT_IN_RANGE) {
                creep.moveToVisual(assignment, 'yellow');
            }
        }
    },

    buildMode: function (creep) {
        if (creep.carry.energy == 0) {
            creep.memory.working = true;
            creep.say("Mining!");
            this.mineMode(creep);
        } else {
            let response = creep.goBuild();
            // console.log('builder:' + response);
            if (response == ERR_NO_TARGET_FOUND) { // no construction jobs
                this.mineMode(creep); // revert to upgrader state
            }
        }
    },

    // Deposit mode: deposit to nearest sink
    depositMode: function (creep) {
        if (creep.carry.energy == 0) {
            creep.memory.working = true;
            creep.say("Mining!");
            this.mineMode(creep);
        } else {
            // Deposit to the closest container. Note: does not change memory.target!
            var closestContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s) => s.structureType == STRUCTURE_CONTAINER
            });
            if (closestContainer) {
                if (closestContainer.hits == closestContainer.hitsMax) { // miners repair their own containers
                    let res = creep.transfer(closestContainer, RESOURCE_ENERGY);
                    if (res == ERR_NOT_IN_RANGE) {
                        creep.moveToVisual(closestContainer);
                    }
                } else {
                    if (creep.repair(closestContainer) == ERR_NOT_IN_RANGE) {
                        creep.moveToVisual(closestContainer);
                    }
                }
            } else {
                console.log(creep.name + ": no container; dropping!");
                creep.drop(RESOURCE_ENERGY);
            }
        }
    },

    depositBuildMode: function (creep, say = false) {
        var allowBuild = false;
        if (creep.room.find(FIND_MY_CONSTRUCTION_SITES).length > 0 && allowBuild) {
            if (say) {
                creep.say("Building!");
            }
            this.buildMode(creep);
        } else {
            if (say) {
                creep.say("Depositing!");
            }
            this.depositMode(creep);
        }
    },

    run: function (creep) {
        // Get an assignment if you don't have one already
        if (!creep.memory.assignment) {
            this.getAssignment(creep);
        }
        var assignedFlag = Game.flags[creep.memory.assignment]; // This is a flag, not an ID!
        if (!creep.isInRoom(assignedFlag.pos.roomName)) { // move to the room the flag is in
            creep.moveToVisual(assignedFlag.pos, 'yellow');
        } else {
            if (creep.memory.working) {
                this.mineMode(creep);
            } else {
                this.depositBuildMode(creep);
            }
        }
    }
};

module.exports = roleRemoteMiner;