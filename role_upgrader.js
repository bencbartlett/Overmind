// Upgrader creep - sits and upgrades spawn
var tasks = require('tasks');

var roleUpgrader = {
    /** @param {Creep} creep **/

    settings: {
        bodyPattern: [WORK, WORK, WORK, WORK, CARRY, MOVE],
    },

    create: function (spawn, {workRoom = spawn.room.name, patternRepetitionLimit = Infinity}) {
        /** @param {StructureSpawn} spawn **/
        var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
        var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
        numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
        // create the body
        var body = [];
        for (let i = 0; i < numRepeats; i++) {
            body = body.concat(bodyPattern);
        }
        // create the creep and initialize memory
        return spawn.createCreep(body, spawn.creepName('upgrader'), {
            role: 'upgrader', workRoom: workRoom, task: null, data: {
                origin: spawn.room.name, replaceAt: 0
            }
        });
    },

    recharge: function (creep) {
        // try to find closest container or storage
        creep.memory.working = false;
        if (creep.workRoom.storage.store[RESOURCE_ENERGY] > creep.workRoom.brain.settings.storageBuffer) {
            return creep.assign(tasks('recharge'), creep.workRoom.storage);
        } else {
            return null;
        }
    },

    newTask: function (creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            return this.recharge(creep);
        } else {
            return creep.workRoom.brain.assignTask(creep);
        }
    },

    executeTask: function (creep) {
        // execute the task
        creep.task.step();
    },

    run: function (creep) {
        // move to service room
        if (creep.conditionalMoveToWorkRoom() != OK) {
            return ERR_NOT_IN_SERVICE_ROOM;
        }
        // get new task if this one is invalid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        // execute task
        if (creep.task) {
            this.executeTask(creep);
        }
    }
};

module.exports = roleUpgrader;