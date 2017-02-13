var roleSupplier = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createCreep([CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
                                 spawn.creepName('supplier'), {role: 'supplier', data: {}});
    },

    // Supply mode: deposit energy to sinks or storage
    supplyMode: function (creep) {
        if (creep.carry.energy == 0) { // Switch to withdraw mode (working = false) when run out of energy
            if (creep.targetDroppedEnergy() == OK) { // try to find any dropped energy
                creep.memory.working = false;
                creep.memory.data.pickup = true;
                creep.say("Pickup!");
                this.pickupMode(creep);
            } else if (creep.targetFullestContainer() == OK) { // try to withdraw from fullest container
                creep.memory.working = false;
                creep.memory.data.pickup = false;
                creep.say("Withdrawing!");
                this.withdrawMode(creep);
            } else if (creep.targetFullestContainer() == OK) { // use storage if all containers are empty
                creep.memory.working = false;
                creep.memory.data.pickup = false;
                creep.say("Withdrawing!");
                this.withdrawMode(creep);
            }
        } else {
            creep.goTransfer();
        }
    },

    // Withdraw mode: withdraw energy from fullest container
    withdrawMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit mode (working = true) when full
            if (creep.targetClosestUntargetedSink() == OK) { // target closest energy sink that isn't already targeted
                creep.memory.working = true;
                creep.say("Supplying!");
                this.supplyMode(creep);
            } else {
                console.log(creep.name + ": no storage or sinks...");
            }
        } else { // if you don't need to switch, go withdraw
            creep.goWithdrawFullest();
        }
    },

    pickupMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit mode (working = true) when full
            if (creep.targetClosestUntargetedSink() == OK) { // target closest energy sink that isn't already targeted
                creep.memory.working = true;
                creep.say("Supplying!");
                this.supplyMode(creep);
            } else {
                console.log(creep.name + ": no storage or sinks...");
            }
        } else { // if you don't need to switch, go withdraw
            if (creep.goPickup() == ERR_NO_TARGET_FOUND) {
                creep.memory.working = false;
                creep.memory.data.pickup = false;
                creep.say("Withdrawing!");
                this.withdrawMode(creep);
            }
        }
    },

    run: function (creep) {
        if (creep.donationHandler() == OK) {
            if (creep.memory.working) {
                this.supplyMode(creep);
            } else {
                if (creep.memory.data.pickup) {
                    this.pickupMode(creep);
                } else {
                    this.withdrawMode(creep);
                }
            }
        }
    }
};

module.exports = roleSupplier;