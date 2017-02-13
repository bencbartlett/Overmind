var roleUpgrader = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createBiggestCreep('upgrader', creepSizeLimit);
    },

    // Upgrade mode: upgrade room controller
    upgradeMode: function (creep) {
        if (creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Withdrawing!");
            this.withdrawMode(creep);
        } else {
            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveToVisual(creep.room.controller, 'purple');
            }
        }
    },

    // Withdraw mode: withdraw energy from storage
    withdrawMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
            creep.say("Upgrading!");
            this.upgradeMode(creep);
        } else {
            creep.goWithdraw();
        }
    },

    run: function (creep) {
        if (creep.memory.working) {
            this.upgradeMode(creep);
        } else {
            this.withdrawMode(creep);
        }
    }
};

module.exports = roleUpgrader;