var roleSupplier = {
    /** @param {Creep} creep **/

    // Supply mode: deposit energy to sinks or storage
    supplyMode: function (creep) {
        if (creep.carry.energy == 0) { // Switch to withdraw mode (working = false) when run out of energy
            if (creep.targetFullestContainer() == OK) { // try to withdraw from fullest container
                creep.memory.working = false;
                creep.say("Withdrawing!");
                this.withdrawMode(creep);
            } else if (creep.targetFullestContainer() == OK) { // use storage if all containers are empty
                creep.memory.working = false;
                creep.say("Withdrawing!");
                this.withdrawMode(creep);
            }
        } else {
            // let res = creep.goTransfer();
            // if (res == ERR_INVALID_TARGET || res == ERR_FULL) {
            //     if (creep.targetClosestSink() == OK) {
            //         creep.goTransfer();
            //     } else {
            //         console.log(creep.name + ": no valid targets!");
            //     }
            // }
            //console.log(creep.name + ':'+ creep.goTask('transfer(target, RESOURCE_ENERGY)', 'targetClosestSink()'));
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

    run: function (creep) {
        if (creep.memory.working) {
            this.supplyMode(creep);
        } else {
            this.withdrawMode(creep);
        }
    }
};

module.exports = roleSupplier;