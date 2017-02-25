// Guard: dumb bot that goes to a flag and then attacks everything hostile in the room

var tasks = require('tasks');

var roleGuard = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [ATTACK, MOVE]
    },

    create: function (spawn, assignment, patternRepetitionLimit = 5) {
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
        return spawn.createCreep(body, spawn.creepName('guard'), {
            role: 'guard', task: null, assignment: assignment,
            data: {origin: spawn.room.name, replaceAt: 0}
        });
    },

    findTarget: function (creep) {
        var target;
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
        }
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        }
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits});
        }
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_CONSTRUCTION_SITES);
        }
        return target;
    },

    run: function (creep) {
        var assignment = Game.flags[creep.memory.assignment];
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            creep.task = null;
            var target = this.findTarget(creep);
            if (target) {
                task = tasks('attack');
                creep.assign(task, target);
            }
        }
        if (creep.task) {
            creep.task.step();
        }
        if (assignment) {
            if (creep.pos.inRangeTo(assignment.pos, 5) && creep.memory.data.replaceAt == 0) {
                creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 25;
            }
            if (!creep.task) {
                creep.moveToVisual(assignment.pos, 'red');
            }
        }
    }
};

module.exports = roleGuard;