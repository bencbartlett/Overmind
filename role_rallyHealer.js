// RallyHealer - meant to complement sieger. Sits in adjacent room to fortified target room and heals damaged siegers

var tasks = require('tasks');
var Role = require('Role');

class roleRallyHealer extends Role {
    constructor() {
        super('rallyHealer');
        // Role-specific settings
        this.settings.bodyPattern = [HEAL, MOVE];
        this.roleRequirements = creep => creep.getActiveBodyparts(HEAL) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }

    create(spawn, assignment, {patternRepetitionLimit = Infinity}) { // TODO: fix this to match new create() standards
        var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
        var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
        numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
        var body = [];
        for (let i = 0; i < numRepeats; i++) {
            body = body.concat(bodyPattern);
        }
        // create the creep and initialize memory
        return spawn.createCreep(body, spawn.creepName('rallyHealer'), {
            role: 'rallyHealer', task: null, assignment: assignment,
            data: {origin: spawn.room.name, replaceAt: 0}
        });
    }

    findTarget(creep) {
        var target;
        var targetPriority = [
            () => creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: c => c.getBodyparts(HEAL) > 0 && c.hits < c.hitsMax
            }), // prioritize healing other healers
            () => creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: c => c.hits < c.hitsMax
            })
        ];
        for (let targetThis of targetPriority) {
            target = targetThis();
            if (target) {
                return target;
            }
        }
        return null;
    }

    run(creep) {
        var assignment = Game.flags[creep.memory.assignment];
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            creep.task = null;
            var target = this.findTarget(creep);
            if (target) {
                let task = tasks('heal');
                creep.assign(task, target);
            }
        }
        if (creep.task) {
            return creep.task.step();
        }
        if (assignment) {
            if (creep.pos.inRangeTo(assignment.pos, 5) && creep.memory.data.replaceAt == 0) {
                creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 25;
            }
            if (!creep.task) {
                creep.moveToVisual(assignment.pos, 'green');
            }
        }
    }
}

// var roleRallyHealer = {
//     /** @param {Creep} creep **/
//     /** @param {StructureSpawn} spawn **/
//     /** @param {Number} creepSizeLimit **/
//
//     settings: {
//         bodyPattern: [HEAL, MOVE] // with repetitionNumber of TOUGH's at beginning
//     },
//
//     create: function (spawn, assignment, {patternRepetitionLimit = Infinity}) {
//         var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
//         var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
//         numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
//         var body = [];
//         if (this.settings.ordered) {
//             for (let part of this.settings.bodyPattern) {
//                 for (let i = 0; i < numRepeats; i++) {
//                     body.push(part);
//                 }
//             }
//         } else {
//             for (let i = 0; i < numRepeats; i++) {
//                 body = body.concat(bodyPattern);
//             }
//         }
//         // create the creep and initialize memory
//         return spawn.createCreep(body, spawn.creepName('rallyHealer'), {
//             role: 'rallyHealer', task: null, assignment: assignment,
//             data: {origin: spawn.room.name, replaceAt: 0}
//         });
//     },
//
//     findTarget: function (creep) {
//         var target;
//         var targetPriority = [
//             () => creep.pos.findClosestByRange(FIND_MY_CREEPS, {
//                 filter: c => c.getBodyparts(HEAL) > 0 && c.hits < c.hitsMax
//             }), // prioritize healing other healers
//             () => creep.pos.findClosestByRange(FIND_MY_CREEPS, {
//                 filter: c => c.hits < c.hitsMax
//             })
//         ];
//         for (let targetThis of targetPriority) {
//             target = targetThis();
//             if (target) {
//                 return target;
//             }
//         }
//         return null;
//     },
//
//     run: function (creep) {
//         var assignment = Game.flags[creep.memory.assignment];
//         if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
//             creep.task = null;
//             var target = this.findTarget(creep);
//             if (target) {
//                 let task = tasks('heal');
//                 creep.assign(task, target);
//             }
//         }
//         if (creep.task) {
//             return creep.task.step();
//         }
//         if (assignment) {
//             if (creep.pos.inRangeTo(assignment.pos, 5) && creep.memory.data.replaceAt == 0) {
//                 creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 25;
//             }
//             if (!creep.task) {
//                 creep.moveToVisual(assignment.pos, 'green');
//             }
//         }
//     }
// };

module.exports = roleRallyHealer;