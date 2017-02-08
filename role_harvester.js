var roleHarvester = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Switch to harvest mode and set new target when done depositing
        if (creep.memory.mode != 'harvest' && creep.carry.energy == 0) {
            creep.memory.mode = 'harvest';
            creep.targetNearestAvailableSource();
            creep.say("Harvesting!")
        }
        // Switch to deposit mode when done harvesting
        if (creep.memory.mode == 'harvest' && creep.carry.energy == creep.carryCapacity) {
            creep.memory.mode = 'deposit';
            creep.targetNearestAvailableSink();
            creep.say("Depositing!")
        }
        // Go harvest while mode is harvest
        if (creep.memory.mode == 'harvest') {
            creep.goHarvest();
        }
        // Deposit energy while mode is deposit
        if (creep.memory.mode == 'deposit') {
           creep.goTransfer();
        }
    }
};

module.exports = roleHarvester;