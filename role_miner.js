// Miner - stationary harvester for container mining. Fills containers and sits in place.
var tasks = require('tasks');

var roleMiner = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/

    settings: {
        bodyPattern: [WORK, WORK, CARRY, MOVE],
        allowBuild: true
    },

    create: function (spawn, assignment, patternRepetitionLimit = 3) { // 6 or 8 parts will saturate a source
        /** @param {StructureSpawn} spawn **/
        var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
        // calculate the most number of pattern repetitions you can use with available energy
        var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
        // make sure the creep is not too big (more than 50 parts)
        numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
        // create the body
        var body = [];
        for (let i = 0; i < numRepeats; i++) {
            body = body.concat(bodyPattern);
        }
        // create the creep and initialize memory
        return spawn.createCreep(body, spawn.creepName('miner'), {
            role: 'miner', working: false, task: null, assignment: assignment, data: {
                origin: spawn.room.name, serviceRoom: spawn.room.name, replaceNow: false
            }
        });
    },

    buildContainer: function (creep, containerSite) {
        var build = tasks('build');
        creep.assign(build, containerSite);
        return OK;
    },

    transfer: function (creep) {
        // try to find closest container or storage
        creep.memory.working = false;
        var target;
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER &&
                           s.store[RESOURCE_ENERGY] > creep.carryCapacity
        });
        if (target) {
            var transfer = tasks('transferEnergy');
            creep.assign(transfer, target);
            return OK;
        } else {
            var drop = tasks('dropEnergy');
            creep.assign(drop);
            creep.log("no container; dropping!");
            return ERR_NO_TARGET_FOUND;
        }
    },

    harvest: function (creep) {
        creep.memory.working = true;
        var target = Game.getObjectById(creep.memory.assignment);
        var taskHarvest = tasks('harvest');
        creep.assign(taskHarvest, target);
        return OK;
    },

    newTask: function (creep) {
        creep.task = null;
        if (creep.carry.energy == 0) { // harvest when empty
            this.harvest(creep);
        } else {
            var nearbyContainerSites = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2, {
                filter: (s) => s.structureType == STRUCTURE_CONTAINER
            });
            if (this.settings.allowBuild && nearbyContainerSites.length > 0) {
                // if building is allowed, check for nearby container sites
                this.buildContainer(creep, nearbyContainerSites[0]);
            } else {
                this.transfer(creep); // transfer to container
            }
        }
        // if (creep.task == null) {
        //     creep.log("newTask returned null task; looping!");
        //     this.newTask(creep);
        // }
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
        if (creep.task) {
            // execute task
            this.executeTask(creep);
        } else {
            creep.log("could not receive task!");
        }
    }
};

module.exports = roleMiner;