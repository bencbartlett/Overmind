// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage

var roleSupplier = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        var body = [];
        for (let i = 0; i < 3; i++) {
            body.push(CARRY);
            body.push(CARRY);
            body.push(MOVE);
        }
        return spawn.createCreep(body, spawn.creepName('supplier'), {role: 'supplier', data: {}, working: true});
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
            } else {
                creep.say("No target!");
            }
        } else {
            let res = creep.goTransfer();
            // console.log(creep.name + ": " + res);
        }
    },

    // Withdraw mode: withdraw energy from fullest container
    withdrawMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit mode (working = true) when full
            if (creep.targetClosestSink() == OK) { // target closest energy sink that isn't already targeted
                creep.memory.working = true;
                creep.say("Supplying!");
                this.supplyMode(creep);
            } else {
                console.log(creep.name + ": no storage or sinks...");
            }
        } else { // if you don't need to switch, go withdraw
            if (creep.goWithdrawFullest() == ERR_NO_TARGET_FOUND) {
                if (creep.targetDroppedEnergy() == OK) { // try to find any dropped energy
                    creep.memory.working = false;
                    creep.memory.data.pickup = true;
                    creep.say("Pickup!");
                    this.pickupMode(creep);
                } else {
                    console.log(creep.name + ": no withdrawable energy sources; switching to supply if >0 energy...");
                    if (creep.carry.energy > 0) {
                        this.supplyMode(creep);
                    }
                }
            }
        }
    },

    pickupMode: function (creep) {
        if (creep.carry.energy == creep.carryCapacity) { // Switch to deposit mode (working = true) when full
            if (creep.targetClosestSink() == OK) { // target closest energy sink that isn't already targeted
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