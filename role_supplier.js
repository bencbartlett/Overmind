// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage

var tasks = require('tasks');

var roleSupplier = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [CARRY, CARRY, MOVE]
    },

    create: function (spawn, {serviceRoom = spawn.room.name, patternRepetitionLimit = 3}) { // 6 or 8 parts will saturate a source
        /** @param {StructureSpawn} spawn **/
        var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
        // calculate the most number of pattern repetitions you can use with available energy
        var numRepeats = Math.floor((spawn.room.energyCapacityAvailable) / spawn.cost(bodyPattern));
        // make sure the creep is not too big (more than 50 parts)
        numRepeats = Math.min(Math.floor(50 / (bodyPattern.length)), numRepeats, patternRepetitionLimit);
        // create the body
        var body = [];
        for (let i = 0; i < numRepeats; i++) {
            body = body.concat(bodyPattern);
        }
        // body.push(WORK);
        // body.push(MOVE);
        return spawn.createCreep(body, spawn.creepName('supplier'), {
            role: 'supplier', working: false, task: null, data: {
                origin: spawn.room.name, serviceRoom: serviceRoom
            }
        });
    },

    requestTask: function (creep) {
        creep.memory.working = true;
        var serviceRoom = Game.rooms[creep.memory.data.serviceRoom];
        return serviceRoom.brain.assignTask(creep);
    },

    recharge: function (creep) {
        creep.memory.working = false;
        var recharge = tasks('recharge');
        var serviceRoom = Game.rooms[creep.memory.data.serviceRoom];
        var containers = serviceRoom.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER &&
                           s.store[RESOURCE_ENERGY] > creep.carryCapacity
        });
        var target;
        if (containers.length > 0) { // loop through results to find the container with the most energy in the room
            target = containers[0];
            var maxFullness = 0;
            for (let i in containers) {
                if (containers[i].store[RESOURCE_ENERGY] > maxFullness) {
                    target = containers[i];
                    maxFullness = containers[i].store[RESOURCE_ENERGY];
                }
            }
        }
        if (!target) {
            target = Game.rooms[creep.memory.data.serviceRoom].storage;
        }
        if (target) {
            creep.assign(recharge, target);
        } else {
            creep.log("no storage or sufficiently full containers in " + creep.memory.data.serviceRoom);
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
        if (creep.task.step() == OK) {
            // this.newTask(creep);
            // this.run(creep);
        }
    },

    run: function (creep) {
        // get new task if this one is invalid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        if (creep.task) {
            // execute task
            this.executeTask(creep);
        } else {
            // creep.log("could not receive task!");
        }
    }
};

module.exports = roleSupplier;