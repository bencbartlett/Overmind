var roleUpgrader = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createBiggestCreep('upgrader', creepSizeLimit);
    },

    getAssignment: function (creep) {
        var untargetedFlags = _.filter(Game.flags, (f) => f.color == COLOR_PURPLE &&
                                                          f.isTargeted('remoteUpgrader').length < Infinity); // max num?
        if (untargetedFlags.length > 0) {
            // new memory object: assignment. Assignment is like target but is never changed
            creep.memory.assignment = untargetedFlags[0].name;
            console.log(creep.name + " assigned to: " + untargetedFlags[0].name);
        } else {
            console.log(creep.name + " could not receive an assignment.");
        }
    },

    // Upgrade mode: upgrade room controller
    upgradeMode: function (creep) {
        if (creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Withdrawing!");
            this.withdrawMode(creep);
        } else {
            // this.repairNearbyDamagedRoad();  // why does this line cause all of them to freeze?
            if (creep.upgradeController(Game.rooms['W19N88'].controller) == ERR_NOT_IN_RANGE) { // TODO: fix this
                creep.moveToVisual(Game.rooms['W19N88'].controller, 'purple');
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
            var res;
            if (creep.room.storage) {
                res = creep.goWithdraw(); // withdraw from closest once you have storage
            } else {
                res = creep.goWithdrawFullest(); // else withdraw from fullest container
            }
            if (res == ERR_NO_TARGET_FOUND) {
                var canHarvest = false;
                if (canHarvest && creep.goHarvest() == OK) {
                    creep.say("Harvesting!");
                } else {
                    console.log(creep.name + ": error finding source target.");
                }
            }
        }
    },

    run: function (creep) {
        if (creep.donationHandler() == OK) {
            if (creep.memory.working) {
                this.upgradeMode(creep);
            } else {
                this.withdrawMode(creep);
            }
        }
    }
};

module.exports = roleUpgrader;