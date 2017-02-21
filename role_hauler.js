// Hauler - brings back energy from reserved outposts
var tasks = require('tasks');

var roleHauler = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [CARRY, CARRY, MOVE]
    },

    create: function (spawn, assignment, {serviceRoom = spawn.room.name, patternRepetitionLimit = 5}) { // 6 or 8 parts will saturate a source
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
        // find the container closest to assignment
        var assignedContainer = Game.getObjectById(assignment).pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER
        });
        return spawn.createCreep(body, spawn.creepName('hauler'), {
            role: 'hauler', working: false, task: null, assignment: assignment, data: {
                origin: spawn.room.name, serviceRoom: serviceRoom, assignedContainer: assignedContainer.id
            }
        });
    },

    collect: function (creep) {
        creep.memory.working = false;
        var withdraw = tasks('recharge');
        withdraw.quiet = true;
        var target = Game.getObjectById(creep.memory.data.assignedContainer);
        creep.assign(withdraw, target);
    },

    transfer: function (creep) {
        creep.memory.working = true;
        var deposit = tasks('transferEnergy');
        var target = Game.rooms[creep.memory.data.serviceRoom].storage;
        if (target) {
            creep.assign(deposit, target);
        } else {
            creep.log("no storage in " + creep.memory.data.serviceRoom);
        }
    },

    newTask: function (creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.collect(creep);
        } else {
            this.transfer(creep);
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