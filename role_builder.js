var upgrader = require('role_upgrader');

var roleBuilder = {
    /** @param {Creep} creep **/
    // Build mode: build any nearby construction jobs
    buildMode: function (creep) {
        if (creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Withdrawing!");
            this.withdrawMode(creep);
        } else {
            let response = creep.goBuild();
            // console.log('builder:' + response);
            if (response == ERR_NO_TARGET_FOUND) { // no construction jobs
                upgrader.run(creep); // revert to upgrader state
            }
        }
    },

    // Withdraw mode: withdraw energy from storage
    withdrawMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) {
            if (creep.targetClosestJob() == OK) {
                creep.memory.working = true;
                creep.say("Building!");
                this.buildMode(creep);
            } else {
                upgrader.run(creep); // act as an upgrader if nothing to build
            }
        } else {
            creep.goWithdraw();
        }
    },

    run: function (creep) {
        if (creep.memory.working) {
            this.buildMode(creep);
        } else {
            this.withdrawMode(creep);
        }
    }
};

module.exports = roleBuilder;