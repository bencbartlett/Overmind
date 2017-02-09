// Miner - stationary harvester for container mining. Fills containers and sits in place.

var roleMiner = {
    /** @param {Creep} creep **/
    getAssignment: function (creep) {
        var remainingAssignments = creep.room.remainingMinerSourceAssignments();
        var minAssignments = Infinity;
        var sourceAssigned = false;
        for (let ID in remainingAssignments) {
            // Scan through room sources until you find one that has remaining possible spots
            if (remainingAssignments[ID] > 0 && remainingAssignments[ID] < minAssignments) {
                sourceAssigned = true;
                minAssignments = remainingAssignments[ID];
                creep.memory.target = ID;
                creep.memory.mode = 'mine';
            }
        }
        if (!sourceAssigned) {
            console.log("ERROR: " + creep.name + " could not receive a mining assignment.");
        } else {
            console.log(creep.name + " assigned to source: " + creep.memory.target);
        }
    },

    run: function (creep) {
        // Get an assignment if you don't have one already
        if (creep.memory.target == undefined) {
            this.getAssignment(creep);
        }
        // Switch to harvest mode and set new target when done depositing
        if (!creep.memory.working && creep.carry.energy == 0) {
            creep.memory.working = true;
            creep.say("Mining!");
        }
        // Switch to deposit mode when done harvesting
        if (creep.memory.working && creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = false;
            creep.say("Depositing!");
        }
        // Go harvest while mode is harvest
        if (creep.memory.working) {
            var target = Game.getObjectById(creep.memory.target);
            if (creep.harvest(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }
        // Deposit energy while mode is deposit
        if (!creep.memory.working) {
            // Deposit to the closest container. Note: does not change memory.target!
            var closestContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                // you have to use FIND_STRUCTURES, not FIND_MY_STRUCTURES; containers are neutral
                filter: (s) => s.structureType == STRUCTURE_CONTAINER
            });
            creep.transfer(closestContainer, RESOURCE_ENERGY);
        }
    }
};

module.exports = roleMiner;