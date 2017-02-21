// Worker creep - combines repairer, builder, and upgrader functionality
var tasks = require('tasks');

var roleWorker = {
    /** @param {Creep} creep **/

    settings: {
        bodyPattern: [WORK, CARRY, MOVE],
        workersCanHarvest: true, // can workers act as harvesters? usually false
        targetFullestContainer: false // if true, target fullest container instead of the closest, ignore storage
    },

    create: function (spawn, patternRepetitionLimit = Infinity) {
        /** @param {StructureSpawn} spawn **/
        var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
        // calculate the most number of pattern repetitions you can use with available energy
        var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
        // make sure the creep is not too big (more than 50 parts)
        numRepeats = Math.min(Math.floor(50/bodyPattern.length), numRepeats, patternRepetitionLimit);
        // create the body
        var body = [];
        for (let i = 0; i < numRepeats; i++) {
            body = body.concat(bodyPattern);
        }
        // create the creep and initialize memory
        return spawn.createCreep(body, spawn.creepName('worker'), {
            role: 'worker', working: false, task: null, data: {
                origin: spawn.room.name, serviceRoom: spawn.room.name
            }
        });
    },

    requestTask: function (creep) {
        creep.memory.working = true;
        var serviceRoom = Game.rooms[creep.memory.data.serviceRoom];
        return serviceRoom.brain.assignTask(creep);
    },

    recharge: function (creep) {
        // try to find closest container or storage
        creep.memory.working = false;
        var target;
        if (this.settings.targetFullestContainer) {
            target = creep.room.fullestContainer();
        } else {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => (s.structureType == STRUCTURE_CONTAINER ||
                                s.structureType == STRUCTURE_STORAGE) &&
                               s.store[RESOURCE_ENERGY] > creep.carryCapacity
            });
        }
        if (target) {
            // assign recharge task to creep
            var taskRecharge = tasks('recharge');
            creep.assign(taskRecharge, target);
            return OK;
        } else {
            // if no targetable containers, see if worker can harvest
            if (this.settings.workersCanHarvest) {
                return this.harvest(creep);
            } else {
                creep.log("no containers found and harvesting disabled!");
                return ERR_NO_TARGET_FOUND;
            }
        }
    },

    harvest: function (creep) {
        creep.memory.working = false;
        var target = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE, {
            filter: (source) => source.openSpots() > 0
        });
        if (target) {
            var taskHarvest = tasks('harvest');
            creep.assign(taskHarvest, target);
            return OK;
        } else {
            creep.log("no harvestable sources found!");
            return ERR_NO_TARGET_FOUND;
        }
    },

    newTask: function (creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.recharge(creep);
        } else {
            this.requestTask(creep);
        }
    },

    executeTask: function (creep) {
        // execute the task
        creep.task.step();
    },

    run: function (creep) {
        // get new task if this one is invalid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        // execute task
        this.executeTask(creep);
    }
};

module.exports = roleWorker;