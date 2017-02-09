var supplier = require('role_supplier');
var upgrader = require('role_upgrader');

var roleHarvester = {
    deprecated: true,
    /** @param {Creep} creep **/
    run: function (creep) {
        if (!this.deprecated) {
            // Switch to harvest working and set new target when done depositing
            if (!creep.memory.working && creep.carry.energy == 0) {
                creep.memory.working = true;
                creep.targetNearestAvailableSource();
                creep.say("Harvesting!")
            }
            // Switch to deposit working when done harvesting
            if (creep.memory.working && creep.carry.energy == creep.carryCapacity) {
                if (creep.targetNearestAvailableSink() == OK) {
                    creep.memory.working = false;
                    creep.say("Depositing!");
                } else {
                    upgrader.run(creep);
                }
            }
            // Go harvest while working is harvest
            if (creep.memory.working) {
                creep.goHarvest();
            }
            // Deposit energy while working is deposit
            if (!creep.memory.working) {
                if (creep.goTransfer() != OK) {
                    upgrader.run(creep);
                }
            }
            else {
                upgrader.run(creep); // run upgrader state if no above conditions are met
            }
        } else {
            supplier.run(creep);
        }
    }
};

module.exports = roleHarvester;