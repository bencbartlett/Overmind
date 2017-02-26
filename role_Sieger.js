// Sieger - large armored worker specializing in taking down walls while under fire
// Best used to siege a contiguous room; healing stations of some sort should be stationed in the neighboring room
// Sieger will dismanlte walls while under fire until it is low enough that it needs to leave the room to be healed

var tasks = require('tasks');
var roleSieger = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [TOUGH, WORK, MOVE],
        ordered: true // assemble like TOUGH TOUGH WORK WORK MOVE MOVE instead of TOUGH WORK MOVE TOUGH WORK MOVE
    },

    create: function (spawn, assignment, patternRepetitionLimit = Infinity) {
        var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
        var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
        numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
        var body = [];
        if (this.settings.ordered) {
            for (let part of this.settings.bodyPattern) {
                for (let i = 0; i < numRepeats; i++) {
                    body.push(part);
                }
            }
        } else {
            for (let i = 0; i < numRepeats; i++) {
                body = body.concat(bodyPattern);
            }
        }
        // create the creep and initialize memory
        return spawn.createCreep(body, spawn.creepName('sieger'), {
            role: 'sieger', task: null, assignment: assignment,
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
        var assignment = creep.assignment;
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) { // get new task
            creep.task = null;
            var target = this.findTarget(creep);
            if (target) {
                task = tasks('dismantle'); // TODO: make this
                creep.assign(task, target);
            }
        }
        if (creep.task) { // execute task
            return creep.task.step();
        }
        if (assignment) {
            if (creep.pos.inRangeTo(assignment.pos, 5) && creep.memory.data.replaceAt == 0) {
                creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 10;
            }
            if (!creep.task) {
                creep.moveToVisual(assignment.pos, 'red');
            }
        }
    }
};

module.exports = roleSieger;