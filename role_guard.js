// Guard: dumb bot that goes to a flag and then attacks everything hostile in the room, returning to flag
// Best used only against low level npc invaders; sized to defend outposts

var tasks = require('tasks');
var Role = require('Role');

class roleGuard extends Role {
    constructor() {
        super('guard');
        // Role-specific settings
        this.settings.bodyPattern = [MOVE, ATTACK, RANGED_ATTACK];
        this.settings.orderedBodyPattern = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(ATTACK) > 1 &&
                                         creep.getActiveBodyparts(RANGED_ATTACK) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }

    create(spawn, {assignment = 'is a flag', workRoom = spawn.roomName, patternRepetitionLimit = Infinity}) {
        if (assignment.room && assignment.room.brain.getTasks('repair').length > 0) { // create a guard to repair stuff
            this.settings.bodySuffix = [WORK, CARRY, MOVE];
            this.settings.proportionalPrefixSuffix = false; // just want one repetition
        }
        return this.createLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: patternRepetitionLimit
        });
    }

    recharge(creep) {
        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0)
        });
        if (target) {
            return creep.assign(tasks('recharge'), target);
        }
    }

    findTarget(creep) {
        var target;
        var targetPriority = [
            () => creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits}),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_CONSTRUCTION_SITES)
        ];
        for (let targetThis of targetPriority) {
            target = targetThis();
            if (target) {
                return target;
            }
        }
        return null;
    }

    newTask(creep) {
        creep.task = null;
        // if not in the assigned room, move there; executed in bottom of run function
        if (creep.assignment && !creep.inSameRoomAs(creep.assignment)) {
            return null;
        }
        // first try to find anything you should attack
        var target = this.findTarget(creep);
        if (target) {
            let task = tasks('attack');
            return creep.assign(task, target);
        }
        // if no hostiles and you can repair stuff, do so
        if (creep.getActiveBodyparts(CARRY) > 0 && creep.getActiveBodyparts(WORK) > 0) {
            if (creep.carry.energy == 0) {
                return this.recharge(creep);
            } else {
                return this.requestTask(creep);
            }
        }
    }

    run(creep) {
        var assignment = creep.assignment;
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget()) ||
            (creep.room.hostiles.length > 0 && creep.task && creep.task.name != 'attack')) {
            this.newTask(creep);
        }
        if (creep.task) {
            return creep.task.step();
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
}


// var roleGuardOld = {
//     /** @param {Creep} creep **/
//     /** @param {StructureSpawn} spawn **/
//     /** @param {Number} creepSizeLimit **/
//
//     settings: {
//         bodyPattern: [ATTACK, MOVE] // with repetitionNumber of TOUGH's at beginning
//     },
//
//     create: function (spawn, assignment, {workerGuard = false, patternRepetitionLimit = 4}) {
//         var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
//         // calculate the most number of pattern repetitions you can use with available energy
//         var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
//         // make sure the creep is not too big (more than 50 parts)
//         numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
//         // create the body
//         var body = [];
//         for (let i = 0; i < numRepeats; i++) {
//             body = body.concat(TOUGH);
//         }
//         for (let i = 0; i < numRepeats; i++) {
//             body = body.concat(bodyPattern);
//         }
//         if (workerGuard) {
//             body = body.concat([WORK, CARRY, MOVE, MOVE]);
//         }
//         // create the creep and initialize memory
//         return spawn.createCreep(body, spawn.creepName('guard'), {
//             role: 'guard', task: null, assignment: assignment,
//             data: {origin: spawn.room.name, workerGuard: workerGuard, replaceAt: 0}
//         });
//     },
//
//     findTarget: function (creep) {
//         var target;
//         if (!target) {
//             target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
//         }
//         if (!target) {
//             target = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
//         }
//         if (!target) {
//             target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits});
//         }
//         if (!target) {
//             target = creep.pos.findClosestByRange(FIND_HOSTILE_CONSTRUCTION_SITES);
//         }
//         return target;
//     },
//
//     requestTask: function (creep) {
//         creep.memory.working = true;
//         return creep.room.brain.assignTask(creep);
//     },
//
//     recharge: function (creep) {
//         var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
//             filter: (s) => (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0)
//         });
//         if (target) {
//             return creep.assign(tasks('recharge'), target);
//         }
//     },
//
//     newTask: function (creep) {
//         creep.task = null;
//         // if not in the assigned room, move there; executed in bottom of run function
//         if (creep.assignment && !creep.inSameRoomAs(creep.assignment)) {
//             return null;
//         }
//         // if there are hostiles, drop everything you're doing and attack them
//         if (creep.room.hostiles.length > 0) {
//             var target = this.findTarget(creep);
//             if (target) {
//                 let task = tasks('attack');
//                 return creep.assign(task, target);
//             }
//         }
//         // if no hostiles and you can repair stuff, do so
//         if (creep.getActiveBodyparts(CARRY) > 0 && creep.getActiveBodyparts(WORK) > 0) {
//             if (creep.carry.energy == 0) {
//                 return this.recharge(creep);
//             } else {
//                 return this.requestTask(creep);
//             }
//         }
//     },
//
//     run: function (creep) {
//         var assignment = creep.assignment;
//         if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget()) ||
//             (creep.room.hostiles.length > 0 && creep.task && creep.task.name != 'attack')) {
//             this.newTask(creep);
//         }
//         if (creep.task) {
//             return creep.task.step();
//         }
//         if (assignment) {
//             if (creep.pos.inRangeTo(assignment.pos, 5) && creep.memory.data.replaceAt == 0) {
//                 creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 25;
//             }
//             if (!creep.task) {
//                 creep.moveToVisual(assignment.pos, 'red');
//             }
//         }
//     }
// };

module.exports = roleGuard;