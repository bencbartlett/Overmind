var roleUpgrader = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Switch to harvest mode and set new target when done depositing
        if (creep.memory.mode != 'harvest' && creep.carry.energy == 0) {
            creep.memory.mode = 'harvest';
            creep.targetNearestAvailableSource();
            creep.say("Harvesting!")
        }
        // Switch to build mode  when done harvesting
        if (creep.memory.mode == 'harvest' && creep.carry.energy == creep.carryCapacity) {
            creep.memory.mode = 'upgrade';
            creep.say("Building!")
        }
        // Go harvest while mode is harvest
        if (creep.memory.mode == 'harvest') {
            creep.goHarvest();
        }
        // Go upgrade while mode is upgrade
        if (creep.memory.mode == 'upgrade') {
            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }
    }
};

module.exports = roleUpgrader;