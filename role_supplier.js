var upgrader = require('role_upgrader');

var roleSupplier = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Switch to withdraw mode (working = false) when run out of energy
        if (creep.memory.working && creep.carry.energy == 0) {
            if (creep.targetFullestContainer() == OK) {
                creep.memory.working = false;
                creep.say("Withdrawing!");
            }
        }
        // Switch to supply mode (working = true) when done withdrawing
        if (!creep.memory.working && creep.carry.energy == creep.carryCapacity) {
            if (creep.targetNearestAvailableSink() == OK) {
                creep.memory.working = true;
                creep.say("Supplying!");
            } else {
                upgrader.run(creep);
            }
        }
        // Go withdraw as needed
        if (!creep.memory.working) {
            creep.goWithdraw();
        }
        // Supply energy sinks
        if (creep.memory.working) {
            if (creep.goTransfer() != OK) {
                upgrader.run(creep);
            }
        }
        else {
            upgrader.run(creep); // run upgrader state if no above conditions are met
        }
    }
};

module.exports = roleSupplier;