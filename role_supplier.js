// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage

var tasks = require('tasks');

var roleSupplier = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [CARRY, CARRY, MOVE],
        assistHaulersAtContainerPercent: 1.1 // help out haulers at >this capacity
    },

    create: function (spawn, {workRoom = spawn.room.name, patternRepetitionLimit = 3}) { // 6 or 8 parts will saturate a source
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
        // static replaceAt to prevent cases where all suppliers die out at the same time
        return spawn.createCreep(body, spawn.creepName('supplier'), {
            role: 'supplier', workRoom: workRoom, working: false, task: null, data: {
                origin: spawn.room.name, replaceAt: 300
            }
        });
    },

    requestTask: function (creep) {
        creep.memory.working = true;
        var task = creep.workRoom.brain.assignTask(creep);
        return task;
    },

    recharge: function (creep) {
        creep.memory.working = false;
        var recharge = tasks('recharge');
        var containers = creep.workRoom.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER
        });
        if (creep.workRoom.storage) {
            containers = _.filter(containers, s => s.store[RESOURCE_ENERGY] >
                                                   this.settings.assistHaulersAtContainerPercent * s.storeCapacity);
        }
        var target;
        if (containers.length > 0) { // loop through results to find the container with the most energy in the room
            let targets = _.sortBy(containers, [function (s) {
                return s.store[RESOURCE_ENERGY]
            }]);
            target = targets[targets.length - 1]; // pick the fullest container
        }
        if (!target) {
            target = creep.workRoom.storage;
        }
        if (target) {
            return creep.assign(recharge, target);
        } else {
            creep.say("Idle");
            return ERR_NO_TARGET_FOUND;
        }
    },

    newTask: function (creep) {
        creep.task = null;
        let newTask = this.requestTask(creep);
        if (newTask == undefined && creep.carry.energy == 0) {
            return this.recharge(creep);
        } else {
            return newTask;
        }
        // if (creep.carry.energy == 0) {
        //     let recharge = this.recharge(creep);
        //     if (recharge == OK) {
        //         return recharge;
        //     }
        // }
        // return this.requestTask(creep);
    },

    executeTask: function (creep) {
        // execute the task
        if (creep.task.step() == OK) {
            // this.newTask(creep);
            // this.run(creep);
        }
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
        if (creep.task) {
            // execute task
            this.executeTask(creep);
        } else {
            creep.moveToVisual(creep.room.spawns[0]); // TODO: implement idle flag position
        }
    }
};

module.exports = roleSupplier;