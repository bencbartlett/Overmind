// Worker creep - combines repairer, builder, and upgrader functionality

var roleWorker = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        fortifyLevel: 30000
    },

    create: function (spawn, creepSizeLimit = Infinity) {
        // create a balanced body as big as possible with the given energy
        var energy = spawn.room.energyCapacityAvailable; // total energy available for spawn + extensions
        var numberOfParts = Math.floor(energy / 200);
        // make sure the creep is not too big (more than 50 parts)
        numberOfParts = Math.min(numberOfParts, Math.floor(50 / 3), numberOfParts);
        var body = [];
        for (let i = 0; i < numberOfParts; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        return spawn.createCreep(body, spawn.creepName('worker'), {
            role: 'worker', working: false, origin: spawn.room.name, data: {}
        });
    },

    decideMode: function (creep) {
        if (creep.memory.task == 'decide') {
            console.log(creep.name + ": decide");
            if (creep.room.isUntargetedRepair() == OK) {
                creep.memory.working = true;
                creep.memory.task = 'repair';
                creep.targetClosestUntargetedRepair();
                creep.say("Repairing!");
                this.repairMode(creep);
            } else if (creep.room.isWallLowerThan(this.settings.fortifyLevel) == OK) {
                creep.memory.working = true;
                creep.memory.task = 'fortify';
                creep.targetClosestWallLowerThan(this.settings.fortifyLevel);
                creep.say("Fortifying!");
                this.fortifyMode(creep);
            } else if (creep.room.isJob() == OK) {
                creep.memory.working = true;
                creep.memory.task = 'build';
                creep.targetClosestJob();
                creep.say("Building!");
                this.buildMode(creep);
            } else {
                creep.memory.working = true;
                creep.memory.task = 'upgrade';
                creep.memory.target = creep.myRoom().controller;
                creep.say("Upgrading!");
                this.upgradeMode(creep);
            }
        } else {
            if (creep.memory.task == 'repair') {
                this.repairMode(creep);
            } else if (creep.memory.task == 'fortify') {
                this.fortifyMode(creep);
            } else if (creep.memory.task == 'build') {
                this.buildMode(creep);
            } else if (creep.memory.task == 'upgrade') {
                this.upgradeMode(creep);
            } else {
                creep.memory.task = 'upgrade';
                this.decideMode(creep);
            }
        }

    },

    // Repair mode: repair nearby structures
    repairMode: function (creep) {
        console.log(creep.name + ": repair");
        if (creep.carry.energy == 0) { // Switch to withdraw mode when out of energy
            creep.memory.working = false;
            creep.say("Recharge!");
            this.withdrawMode(creep);
        } else {
            let response = creep.goRepair();
            if (response == ERR_NO_TARGET_FOUND) {
                creep.memory.task = 'decide';
                this.decideMode(creep);
            }
        }
    },

    // Fortify mode: repair walls to a certain HP level
    fortifyMode: function (creep) {
        console.log(creep.name + ": fortify");
        creep.memory.task = 'fortify';
        if (creep.carry.energy == 0) { // Switch to withdraw mode when out of energy
            creep.memory.working = false;
            creep.say("Recharge!");
            this.withdrawMode(creep);
        } else {
            let response = creep.goFortify(this.settings.fortifyLevel);
            if (response == ERR_NO_TARGET_FOUND) {
                creep.memory.task = 'decide';
                this.decideMode(creep);
            }
        }
    },

    // Build mode: build any nearby construction jobs
    buildMode: function (creep) {
        console.log(creep.name + ": build");
        creep.memory.task = 'build';
        if (creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Recharge!");
            this.withdrawMode(creep);
        } else {
            let response = creep.goBuild();
            if (response == ERR_NO_TARGET_FOUND) { // no construction jobs
                creep.memory.task = 'decide';
                this.decideMode(creep);
            }
        }
    },

    // Upgrade mode: upgrade room controller
    upgradeMode: function (creep) {
        console.log(creep.name + ": upgrade");
        creep.memory.task = 'upgrade';
        if (creep.carry.energy == 0) {
            creep.memory.working = false;
            creep.say("Recharge!");
            this.withdrawMode(creep);
        } else {
            // this.repairNearbyDamagedRoad();  // why does this line cause all of them to freeze?
            var controller = Game.rooms[creep.memory.origin].controller;
            if (creep.upgradeController(controller) == ERR_NOT_IN_RANGE) { // TODO: fix this
                creep.moveToVisual(controller, 'purple');
            }
        }
    },

    // Withdraw mode: withdraw energy from storage
    withdrawMode: function (creep) {
        console.log(creep.name + ": withdraw");
        creep.memory.task = 'withdraw';
        if (creep.carry.energy == creep.carryCapacity) {
            creep.memory.working = true;
            creep.memory.task = 'decide';
            this.decideMode(creep);
        } else {
            creep.goWithdraw();
        }
    },

    run: function (creep) {
        if (creep.donationHandler() == OK) {
            if (creep.memory.working) {
                this.decideMode(creep);
            } else {
                this.withdrawMode(creep);
            }
        }
    }
};

module.exports = roleWorker;