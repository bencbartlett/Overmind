// Hauler - brings back energy from reserved outposts
var tasks = require('tasks');

var roleHauler = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [CARRY, CARRY, MOVE]
    },

    create: function (spawn, assignment, {workRoom = spawn.room.name, patternRepetitionLimit = 5, remote = false}) {
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
            role: 'hauler', workRoom: workRoom, task: null, assignment: assignment, remote: remote, working: false,
            data: {origin: spawn.room.name}
        });
    },

    collect: function (creep) { // TODO: add ignorecreep and path caching to move() in hauler task classes
        creep.memory.working = false;
        var recharge = tasks('recharge');
        recharge.data.quiet = true;
        var assignment;
        assignment = deref(creep.memory.assignment);
        if (!assignment.room) { // if you don't have vision of the room
            return creep.moveToVisual(assignment.pos, 'blue');
        }
        var nearbyContainers = assignment.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER
        });
        // target fullest of nearby containers
        var target = _.sortBy(nearbyContainers,
                              container => container.store[RESOURCE_ENERGY])[nearbyContainers.length - 1];
        creep.assign(recharge, target);
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
        var pathLength;
        if (creep.memory.remote) {
            pathLength = deref(creep.memory.assignment).pathLengthToAssignedRoomStorage;
        } else {
            pathLength = deref(creep.memory.assignment).pathLengthToStorage;
        }
        if (creep.carry.energy == 0) {
            if (creep.ticksToLive > (2 + 0.5) * pathLength) { // +0.5 for buffer
                this.collect(creep);
            } else {
                creep.suicide(); // kill off so you don't randomly drop tons of energy everywhere
            }
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
        }
    }
};

module.exports = roleHauler;