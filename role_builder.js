var upgrader = require('role_upgrader');

var roleBuilder = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Switch to withdraw mode and set new target when done building
        if (creep.memory.working && creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Withdrawing!");
        }
        // Switch to build mode and set new target when done withdrawing
        if (!creep.memory.working && creep.carry.energy == creep.carryCapacity) {
            if (creep.targetNearestJob() == OK) {
                creep.memory.working = true;
                creep.say("Building!");
            } else {
                upgrader.run(creep); // act as an upgrader if nothing to build
            }
        }
        // Go harvest while mode is harvest
        if (!creep.memory.working) {
            creep.goWithdraw();
        }
        // Go build while mode is build
        if (creep.memory.working) {
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