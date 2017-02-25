// Miner - stationary harvester for container mining. Fills containers and sits in place.
var tasks = require('tasks');

var roleMiner = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/

    settings: {
        bodyPattern: [WORK, WORK, CARRY, MOVE],
        remoteBodyPattern: [WORK, WORK, CARRY, MOVE],
        allowBuild: true
    },

    create: function (spawn, assignment, {workRoom = spawn.room.name, patternRepetitionLimit = 3, remote = false}) {
        /** @param {StructureSpawn} spawn **/
        var bodyPattern;
        if (remote) {
            bodyPattern = this.settings.remoteBodyPattern;
        } else {
            bodyPattern = this.settings.bodyPattern;
        }
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
            role: 'miner', workRoom: workRoom, task: null, remote: remote, assignment: assignment, working: false,
            data: {origin: spawn.room.name, replaceAt: 0}
        });
    },

    buildContainer: function (creep, containerSite) {
        var build = tasks('build');
        creep.assign(build, containerSite);
        return OK;
    },

    repairContainer: function (creep, container) {
        var repair = tasks('repair');
        creep.assign(repair, container);
        return OK;
    },

    deposit: function (creep) {
        creep.memory.working = false;
        // select emptiest of containers that are within range 1 of creep (helps with adjacent sources)
        var target = _.sortBy(creep.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER
        }), container => container.store[RESOURCE_ENERGY])[0];
        if (target) {
            var deposit = tasks('deposit');
            deposit.data.quiet = true;
            creep.assign(deposit, target);
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
        var target;
        if (!creep.memory.remote) {
            target = Game.getObjectById(creep.memory.assignment);
        } else {
            target = Game.flags[creep.memory.assignment].pos.lookFor(LOOK_SOURCES)[0];
        }
        var taskHarvest = tasks('harvest');
        taskHarvest.data.quiet = true;
        creep.assign(taskHarvest, target);
        return OK;
    },

    newTask: function (creep) {
        // 1: harvest when empty
        creep.task = null;
        if (creep.carry.energy == 0) {
            return this.harvest(creep);
        }
        // 1.5: log first time of deposit or build tasks as replacement time
        if (creep.memory.data.replaceAt == 0) {
            creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 10;
        }
        // 2: find any nearby damaged containers and repair them
        var damagedContainers = creep.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.hits < s.hitsMax
        });
        if (damagedContainers.length > 0) {
            return this.repairContainer(creep, damagedContainers[0]);
        }
        // 3: build construction sites
        if (this.settings.allowBuild) {
            var constructionSites;
            if (creep.memory.remote) {
                constructionSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES); // remote miners can build whatever
            } else {
                constructionSites = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2, {
                    filter: (s) => s.structureType == STRUCTURE_CONTAINER
                });
            }
            if (constructionSites.length > 0) {
                // if building is allowed, check for nearby container sites
                return this.buildContainer(creep, creep.pos.findClosestByRange(constructionSites));
            }
        }
        // 4: deposit into container
        return this.deposit(creep);
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