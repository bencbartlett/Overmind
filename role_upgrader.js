var roleUpgrader = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Switch to withdraw mode (working=false) when done upgrading
        if (creep.memory.working && creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Withdrawing!");
        }
        // Switch to upgrading when enough energy
        if (!creep.memory.working && creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
            creep.say("Upgrading!")
        }
        // Go harvest while mode is harvest
        if (!creep.memory.working) {
            creep.goWithdraw();
        }
        // Go upgrade while mode is upgrade
        if (creep.memory.working) {
            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }
    }
};

module.exports = roleUpgrader;