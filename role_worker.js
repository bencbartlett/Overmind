// Worker creep - combines repairer, builder, and upgrader functionality
var tasks = require('tasks');

var roleWorker = {
    /** @param {Creep} creep **/

    settings: {
        workersCanHarvest: true, // can workers act as harvesters? usually false
        targetFullestContainer: false // if true, target fullest container instead of the closest, ignore storage
    },

    create: function (spawn, creepSizeLimit = Infinity) {
        /** @param {StructureSpawn} spawn **/
        /** @param {Number} creepSizeLimit **/

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
            role: 'worker', working: false, task: null, origin: spawn.room.name, data: {}
        });
    },

    requestTask: function (creep) {
        creep.memory.working = true;
        let res = creep.room.brain.assignTask(creep);
        return res;
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