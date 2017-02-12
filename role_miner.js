// Miner - stationary harvester for container mining. Fills containers and sits in place.

var roleMiner = {
    /** @param {Creep} creep **/
    getAssignment: function (creep) {
        var remainingAssignments = creep.room.remainingMinerSourceAssignments();
        var maxRemainingAssignments = 0;
        for (let ID in remainingAssignments) {
            // Scan through room sources until you find one that has the most remaining open spots
            if (remainingAssignments[ID] > 0 && remainingAssignments[ID] > maxRemainingAssignments) {
                maxRemainingAssignments = remainingAssignments[ID];
                creep.memory.target = ID;
            }
        }
        if (maxRemainingAssignments == 0) {
            console.log("ERROR: " + creep.name + " could not receive a mining assignment.");
            return ERR_NO_TARGET_FOUND;
        } else {
            console.log(creep.name + " assigned to source: " + creep.memory.target);
            return OK;
        }
    },

    mineMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit working when done harvesting
            creep.memory.working = false;
            creep.say("Depositing!");
            this.depositMode(creep);
        } else {
            var target = Game.getObjectById(creep.memory.target);
            if (creep.harvest(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
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
            if (closestContainer.hits >= closestContainer.hitsMax) { // miners repair their own containers
                creep.transfer(closestContainer, RESOURCE_ENERGY);
            } else {
                creep.repair(closestContainer);
            }
        }
    },

    run: function (creep) {
        // Get an assignment if you don't have one already
        if (!creep.memory.target) {
            this.getAssignment(creep);
        }
        if (creep.memory.working) {
            this.mineMode(creep);
        } else {
            this.depositMode(creep);
        }
    }
};

module.exports = roleMiner;