// Miner - stationary harvester for container mining. Fills containers and sits in place.

var roleMiner = {
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
        body.push(MOVE);
        return spawn.createCreep(body, spawn.creepName('miner'), {role: 'miner'});
    },

    getAssignment: function (creep) {
        var remainingAssignments = creep.room.remainingMinerSourceAssignments();
        var maxRemainingAssignments = 0;
        for (let ID in remainingAssignments) {
            // Scan through room sources until you find one that has the most remaining open spots
            if (remainingAssignments[ID] > 0 && remainingAssignments[ID] > maxRemainingAssignments) {
                maxRemainingAssignments = remainingAssignments[ID];
                creep.memory.assignment = ID;
            }
        }
        if (maxRemainingAssignments == 0) {
            console.log("ERROR: " + creep.name + " could not receive a mining assignment.");
            return ERR_NO_TARGET_FOUND;
        } else {
            console.log(creep.name + " assigned to source: " + creep.memory.assignment);
            return OK;
        }
    },

    mineMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit working when done harvesting
            creep.memory.working = false;
            this.depositBuildMode(creep, true);
        } else {
            var assignment = Game.getObjectById(creep.memory.assignment);
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
                // you have to use FIND_STRUCTURES, not FIND_MY_STRUCTURES; containers are neutral
                filter: (s) => s.structureType == STRUCTURE_CONTAINER
            });
            if (closestContainer) {
                if (closestContainer.hits == closestContainer.hitsMax) { // miners repair their own containers
                    let res = creep.transfer(closestContainer, RESOURCE_ENERGY);
                    if (res == ERR_NOT_IN_RANGE) {
                        creep.moveToVisual(closestContainer);
                    }
                } else {
                    creep.repair(closestContainer);
                }
            } else {
                console.log(creep.name + ": no container; dropping!");
                creep.drop(RESOURCE_ENERGY);
            }
        }
    },

    depositBuildMode: function (creep, say = false) {
        var allowBuild = true;
        if (creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2, {
                filter: (s) => s.structureType == STRUCTURE_CONTAINER // miners can help build their own containers
            }).length > 0 && allowBuild) {
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
        if (creep.donationHandler() == OK) {
            // Get an assignment if you don't have one already
            if (!creep.memory.assignment) {
                this.getAssignment(creep);
            }
            if (creep.memory.working) {
                this.mineMode(creep);
            } else {
                this.depositBuildMode(creep);
            }
        }
    }
};

module.exports = roleMiner;