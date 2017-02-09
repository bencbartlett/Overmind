var builder = require('role_builder');

var roleRepairer = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Switch to withdraw mode when no energy
        if (creep.memory.working && creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.targetNearestAvailableSource();
            creep.say("Harvesting!")
        }
        // Switch to repair mode when done withdrawing
        if (!creep.memory.working && creep.carry.energy == creep.carryCapacity) {
            if (creep.targetNearestRepair() == OK) {
                creep.memory.working = true;
                creep.say("Repairing!");
            } else {
                builder.run(creep); // act as a builder if nothing to repair
            }
        }
        // Go harvest while mode is harvest
        if (!creep.memory.working) {
            creep.goWithdraw();
        }
        // Deposit energy while mode is deposit
        if (creep.memory.working) {
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