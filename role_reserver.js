// Reserver: reserves rooms targeted with a purple/grey flag or claims a room with purple/purple flag
var tasks = require('tasks');

var roleReserver = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [CLAIM, MOVE]
    },

    create: function (spawn, assignment, patternRepetitionLimit = 2) {
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
        return spawn.createCreep(body, spawn.creepName('reserver'), {
            role: 'reserver', task: null, assignment: assignment,
            data: {origin: spawn.room.name, replaceAt: 0}
        });
    },

    run: function (creep) {
        var target = Game.flags[creep.memory.assignment];
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            creep.task = null;
            let task = tasks('reserve');
            creep.assign(task, target.room.controller);
        }
        if (creep.pos.inRangeTo(target.pos, 1) && creep.memory.data.replaceAt == 0) {
            creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 25;
        }
        if (creep.task) {
            creep.task.step();
        }
    }
};

module.exports = roleReserver;