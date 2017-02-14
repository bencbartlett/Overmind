var upgrader = require('role_upgrader');

var roleHarvester = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/

    create: function (spawn, creepSizeLimit = Infinity) {
        // create a balanced body as big as possible with the given energy
        var energy = spawn.room.energyCapacityAvailable; // total energy available for spawn + extensions
        var numberOfParts = Math.floor(energy / 200);
        // make sure the creep is not too big (more than 50 parts)
        numberOfParts = Math.min(numberOfParts, Math.floor(50 / 3), creepSizeLimit);
        var body = [WORK, CARRY, MOVE, MOVE];
        // create creep with the created body and the given role
        return spawn.createCreep(body, spawn.creepName('harvester'), {role: 'harvester'});
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
            creep.goHarvest();
            // if (creep.goHarvest() == ERR_NO_TARGET_FOUND) { // Go harvest while working is harvest
            //     // upgrader.run(creep); // be an upgrader if that doesn't work
            // }
        }
    },

    // Deposit mode: deposit to nearest sink
    depositMode: function (creep) {
        if (creep.carry.energy == 0) { // Switch to harvest working and set new target when done depositing
            if (creep.targetClosestUnsaturatedSource() == OK) {
                creep.memory.working = true;
                creep.say("Harvesting!");
                this.harvestMode(creep);
            } 
        } else {
            creep.goTransfer();
            // if (creep.goTransfer() == ERR_NO_TARGET_FOUND) {
            //     // upgrader.run(creep); // If you can't do that, then act as an upgrader
            // }
        }
    },

    deprecated: false, // set to true if harvesters have been replaced with container mining

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