var upgrader = require('role_upgrader');

var roleBuilder = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createBiggestCreep('builder', creepSizeLimit);
    },

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
            var canHarvest = false; // decides whether builders can try to be their own harvesters (early RCL)
            if (creep.goWithdraw() == ERR_NO_TARGET_FOUND) {
                //if (creep.goPickup() == OK) {
                //    creep.say("Pickup!");
                //} else 
                if (canHarvest && creep.goHarvest() == OK) {
                    creep.say("Harvesting!");
                } //else if (creep.carry.energy > 10) {
                  //  creep.memory.working = true;
                  //  creep.say("Building!");
                  //  this.buildMode(creep);
                //} else {
                //    console.log(creep.name + ": error finding source target.");
                //}
            }
        }
    },

    pickupMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit mode (working = true) when full
            if (creep.targetClosestUntargetedSink() == OK) { // target closest energy sink that isn't already targeted
                creep.memory.working = true;
                creep.memory.data.pickup = false;
                creep.say("Supplying!");
                this.supplyMode(creep);
            } else {
                console.log(creep.name + ": no storage or sinks...");
            }
        } else { // if you don't need to switch, go withdraw
            let res = creep.goPickup();
            console.log(creep.name + ": " + res);
            if (res == ERR_NO_TARGET_FOUND) {
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
                this.buildMode(creep);
            } else {
                this.withdrawMode(creep);
            }
        }
    }
};

module.exports = roleBuilder;