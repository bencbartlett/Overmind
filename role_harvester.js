var upgrader = require('role_upgrader');

var roleHarvester = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createBiggestCreep('repairer', creepSizeLimit);
    },

    // Harvest mode: harvest from nearest source
    harvestMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit working when done harvesting
            if (creep.targetClosestSink() == OK) { // try to target nearest thing requiring energy
                creep.memory.working = false;
                creep.say("Depositing!");
                this.depositMode(creep);
            } else {
                upgrader.run(creep); // if nothing needs energy, be an upgrader
            }
        } else {
            if (creep.goHarvest() != OK) { // Go harvest while working is harvest
                upgrader.run(creep); // be an upgrader if that doesn't work
            }
        }
    },

    // Deposit mode: deposit to nearest sink
    depositMode: function (creep) {
        if (creep.carry.energy == 0) { // Switch to harvest working and set new target when done depositing
            if (creep.targetClosestUnsaturatedSource() == OK) {
                creep.memory.working = true;
                creep.say("Harvesting!");
                this.harvestMode(creep);
            } else {
                upgrader.run(creep);
            }
        } else {
            if (creep.goTransfer() != OK) { // Deposit energy while working is deposit
                upgrader.run(creep); // If you can't do that, then act as an upgrader
            }
        }
    },

    deprecated: true, // set to true if harvesters have been replaced with container mining

    run: function (creep) {
        if (!this.deprecated) {
            if (creep.donationHandler() == OK) {
                if (creep.memory.working) {
                    this.harvestMode(creep);
                } else {
                    this.depositMode(creep);
                }
            }
        } else {
            upgrader.run(creep); // harvesters become upgraders if deprecated
        }
    }
};

module.exports = roleHarvester;