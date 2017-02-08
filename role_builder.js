var roleBuilder = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Switch to harvest mode and set new target when done depositing
        if (creep.memory.mode != 'harvest' && creep.carry.energy == 0) {
            creep.memory.mode = 'harvest';
            creep.targetNearestAvailableSource();
            creep.say("Harvesting!")
        }
        // Switch to build mode and set new target when done harvesting
        if (creep.memory.mode == 'harvest' && creep.carry.energy == creep.carryCapacity) {
            let res = creep.targetNearestJob();
            if (res == 0) {
                creep.memory.mode = 'build';
                creep.say("Building!")
            } else if (res == 1) {
                creep.memory.mode = 'deposit';
                creep.say("No jobs, depositing!")
            }
        }
        // Go harvest while mode is harvest
        if (creep.memory.mode == 'harvest') {
            creep.goHarvest();
        }
        // Go build while mode is build
        if (creep.memory.mode == 'build') {
            let res = creep.goBuild();
            if (res == 1) {
                creep.memory.mode = 'deposit';
            }
        }
        // Deposit energy while mode is deposit
        if (creep.memory.mode == 'deposit') {
            creep.goTransfer();
        }
    }
};

module.exports = roleBuilder;