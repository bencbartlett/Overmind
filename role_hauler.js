var roleHauler = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Switch to withdraw mode (working = false) when run out of energy
        if (creep.memory.working && creep.carry.energy == 0) {
            if (creep.targetFullestContainer() == OK) {
                creep.memory.working = false;
                creep.say("Withdrawing!");
            }
        }
        // Switch to deposit mode (working = true) when done withdrawing
        if (!creep.memory.working && creep.carry.energy == creep.carryCapacity) {
            if (creep.room.storage != undefined) {
                creep.memory.target = creep.room.storage.id;
                creep.memory.working = true;
                creep.say("Storing!");
            } else {
                if (creep.targetNearestAvailableSink() == OK) {
                    creep.memory.working = true;
                    creep.say("Supplying!");
                } else {
                    console.log(creep.name + ": no storage or sinks...");
                }
            }
        }
        // Go withdraw as needed
        if (!creep.memory.working) {
            creep.goWithdraw();
        }
        // Supply energy sinks
        if (creep.memory.working) {
            let res = creep.goTransfer();
            if (res == ERR_INVALID_TARGET || res == ERR_FULL) {
                console.log(creep.name + ": invalid target or full...");
            }
        }
    }
};

module.exports = roleHauler;