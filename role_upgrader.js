var roleUpgrader = {
    /** @param {Creep} creep **/
    // Upgrade mode: upgrade room controller
    upgradeMode: function (creep) {
        if (creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Withdrawing!");
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
        } else {
            creep.goWithdrawStorage();
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