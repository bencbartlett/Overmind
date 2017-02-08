var upgrader = require('role_upgrader');

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
            if (creep.targetNearestJob() == OK) {
                creep.memory.mode = 'build';
                creep.say("Building!");
            } else {
                upgrader.run(creep); // act as an upgrader if nothing to build
            }
        }
        // Go harvest while mode is harvest
        if (creep.memory.mode == 'harvest') {
            creep.goHarvest();
        }
        // Go build while mode is build
        if (creep.memory.mode == 'build') {
            if (creep.goBuild() != OK) {
                upgrader.run(creep); // revert to upgrader state
            }
        }
        else {
            upgrader.run(creep); // run upgrader state if no above conditions are met
        }
    }
};

module.exports = roleBuilder;