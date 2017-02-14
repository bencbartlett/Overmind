// Worker creep - combines repairer, builder, and upgrader functionality
// TODO: this should really be a major refactor. Room logic should go in the room object
var roleWorker = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        // create a balanced body as big as possible with the given energy
        var energy = this.room.energyCapacityAvailable; // total energy available for spawn + extensions
        var numberOfParts = Math.floor(energy / 200);
        // make sure the creep is not too big (more than 50 parts)
        numberOfParts = Math.min(numberOfParts, Math.floor(50 / 3), partsLimit);
        var body = [];
        for (let i = 0; i < numberOfParts; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        return spawn.createCreep(body, spawn.creepName('worker'), {
            role: 'worker', working: false, origin: creep.room.name, data: {}
        });
    },

    // Repair mode: repair nearby structures
    repairMode: function (creep) {
        if (creep.carry.energy == 0) { // Switch to withdraw mode when out of energy
            creep.memory.working = false;
            creep.say("Recharge!");
            this.withdrawMode(creep);
        } else {
            if (creep.goRepair() == ERR_NO_TARGET_FOUND) {
                this.buildMode(creep);
            }
        }
    },

    // Fortify mode: repair walls to a certain HP level
    fortifyMode: function (creep) {
        if (creep.carry.energy == 0) { // Switch to withdraw mode when out of energy
            creep.memory.working = false;
            creep.say("Recharge!");
            this.withdrawMode(creep);
        } else {
            if (creep.goRepair() == ERR_NO_TARGET_FOUND) {
                this.buildMode(creep);
            }
        }
    },

    // Build mode: build any nearby construction jobs
    buildMode: function (creep) {
        if (creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Recharge!");
            this.withdrawMode(creep);
        } else {
            let response = creep.goBuild();
            if (response == ERR_NO_TARGET_FOUND) { // no construction jobs
                this.upgradeMode(creep); // revert to upgrader state
            }
        }
    },

    // Upgrade mode: upgrade room controller
    upgradeMode: function (creep) {
        if (creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Recharge!");
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
            if (creep.targetClosestUntargetedRepair() == OK) {
                creep.memory.working = true;
                creep.say("Repairing!");
                this.repairMode(creep);
            } else if (creep.targetClosestWallLowerThan(1) == OK) { // manual cutoff
                creep.memory.working = true;
                creep.say("Fortifying!");
                this.repairMode(creep);
            } else {
                builder.run(creep); // act as a builder if nothing to repair
            }
        } else {
            creep.goWithdraw();
        }
    },

    run: function (creep) {
        if (creep.donationHandler() == OK) {
            if (creep.memory.working) {
                this.repairMode(creep);
            } else {
                this.withdrawMode(creep);
            }
        }
    }
};

module.exports = roleWorker;