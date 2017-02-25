// Hauler - brings back energy from reserved outposts
var tasks = require('tasks');

var roleHauler = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [CARRY, CARRY, MOVE]
    },

    create: function (spawn, assignment, {workRoom = spawn.room.name, patternRepetitionLimit = 5}) {
        /** @param {StructureSpawn} spawn **/
        var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
        // calculate the most number of pattern repetitions you can use with available energy
        var numRepeats = Math.floor((spawn.room.energyCapacityAvailable - 150) / spawn.cost(bodyPattern));
        // make sure the creep is not too big (more than 50 parts)
        numRepeats = Math.min(Math.floor(50 / (bodyPattern.length + 2)), numRepeats, patternRepetitionLimit);
        // create the body
        var body = [];
        for (let i = 0; i < numRepeats; i++) {
            body = body.concat(bodyPattern);
        }
        body.push(WORK);
        body.push(MOVE);
        return spawn.createCreep(body, spawn.creepName('hauler'), {
            role: 'hauler', workRoom: workRoom, working: false, task: null, assignment: assignment, data: {
                origin: spawn.room.name
            }
        });
    },

    collect: function (creep) {
        creep.memory.working = false;
        var withdraw = tasks('recharge');
        withdraw.data.quiet = true;
        var nearbyContainers = Game.getObjectById(creep.memory.assignment).pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER
        });
        // target fullest of nearby containers
        var target = _.sortBy(nearbyContainers,
                              container => container.store[RESOURCE_ENERGY])[nearbyContainers.length - 1];
        creep.assign(withdraw, target);
    },

    deposit: function (creep) {
        creep.memory.working = true;
        var deposit = tasks('deposit');
        deposit.data.quiet = true;
        var target = creep.workRoom.storage;
        if (target) {
            creep.assign(deposit, target);
        } else {
            creep.log("no storage in " + creep.workRoom.name);
        }
    },

    newTask: function (creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.collect(creep);
        } else {
            this.deposit(creep);
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
        if (creep.task) {
            // execute task
            this.executeTask(creep);
        } else {
            creep.log("could not receive task!");
        }
    }
};

module.exports = roleHauler;