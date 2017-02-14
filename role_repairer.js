var builder = require('role_builder');

var roleRepairer = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createBiggestCreep('repairer', creepSizeLimit);
    },

    // Repair mode: repair nearby structures less than X% health
    repairMode: function (creep) {
        if (creep.carry.energy == 0) { // Switch to withdraw mode when out of energy
            creep.memory.working = false;
            creep.say("Withdrawing!");
            this.withdrawMode(creep);
        } else {
            if (creep.goRepair() == ERR_NO_TARGET_FOUND) {
                builder.run(creep);
            }
        }
    },

    // Withdraw mode: withdraw energy from storage
    withdrawMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) {
            if (creep.targetClosestUntargetedRepair() == OK) {
                creep.memory.working = true;
                creep.say("Repairing!");
                this.repairMode(creep);
            } else if (creep.targetClosestWallLowerThan(1) == OK) { // manual cutoff
                creep.memory.working = true;
                creep.say("Fortifying!");
                this.repairMode(creep);
            } else {
                builder.run(creep); // act as a builder if nothing to repair
            }
        } else {
            creep.goWithdraw();
        }
    },

    run: function (creep) {
        if (creep.donationHandler() == OK) {
            if (creep.memory.working) {
                this.repairMode(creep);
            } else {
                this.withdrawMode(creep);
            }
        }
    }
};

module.exports = roleRepairer;