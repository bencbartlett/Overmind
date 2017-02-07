var roleHarvester = {

    /** @param {Creep} creep **/
    getAssignment: function (creep) {
        var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
        var sources = creep.room.find(FIND_SOURCES);
        for (i in sources) {
            var numAssigned = _.filter(harvesters, (creep) => creep.memory.assignment == sources[i]).length;
            if (numAssigned <= 3) {
                creep.memory.assignment = sources[i];
            }
        }
    },

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.carry.energy < creep.carryCapacity) {
            // Naive strategy: harvest from closest source while energy isn't full
            // if(!creep.memory.assignment) {
            var sources = creep.room.find(FIND_SOURCES);
            if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0]);
            }
            // } else {
            //     if(creep.harvest(creep.memory.assignment) == ERR_NOT_IN_RANGE) {
            //         creep.moveTo(creep.memory.assignment);
            //     }
            // }
        }

        // Deposit at available locations
        else {
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER) &&
                        structure.energy < structure.energyCapacity;
                }
            });
            if (targets.length > 0) {
                if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0]);
                }
            }
        }
    }
};

module.exports = roleHarvester;