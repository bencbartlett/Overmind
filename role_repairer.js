var builder = require('role_builder');

var roleRepairer = {
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
            if (creep.targetNearestRepair() == OK) {
                creep.memory.mode = 'repair';
                creep.say("Repairing!");
            } else {
                builder.run(creep); // act as a builder if nothing to repair
            }

        }
        // Go harvest while mode is harvest
        if (creep.memory.mode == 'harvest') {
            creep.goHarvest();
        }
        // Deposit energy while mode is deposit
        if (creep.memory.mode == 'repair') {
            if (creep.goRepair() != OK) {
                builder.run(creep);
            }
        }
        else {
            builder.run(creep); // run builder state if no above conditions are met
        }
    }
};

module.exports = roleRepairer;