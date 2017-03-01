// Sieger - large armored worker specializing in taking down walls while under fire
// Best used to siege a contiguous room; healing stations of some sort should be stationed in the neighboring room
// Sieger will dismanlte walls while under fire until it is low enough that it needs to leave the room to be healed

var tasks = require('tasks');
var flagCodes = require('map_flag_codes');
var Role = require('Role');

class roleSieger extends Role {
    constructor() {
        super('upgrader');
        // Role-specific settings
        this.settings.bodyPattern = [TOUGH, WORK, MOVE];
        this.settings.orderedBodyPattern = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(WORK) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }

    // TODO: consistent create() format
    create(spawn, assignment, {healFlag = null, patternRepetitionLimit = Infinity}) {
        var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
        var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
        numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
        var body = [];
        if (this.settings.orderedBodyPattern) {
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
            role: 'sieger', task: null, assignment: assignment, needsHealing: false,
            data: {origin: spawn.room.name, replaceAt: 0, healFlag: healFlag}
        });
    }

    findTarget(creep) {
        var target;
        var targetPriority = [
            () => creep.pos.findClosestByRange(_.filter(creep.room.flags, flagCodes.destroy.dismantle.filter)),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
            () => creep.pos.findClosestByRange(
                FIND_HOSTILE_STRUCTURES, {filter: s => s.hits && s.structureType == STRUCTURE_TOWER}),
            () => creep.pos.findClosestByRange(
                FIND_HOSTILE_STRUCTURES, {filter: s => s.hits && s.structureType != STRUCTURE_RAMPART}),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits})
        ];
        for (let targetThis of targetPriority) {
            target = targetThis();
            if (target) {
                return target;
            }
        }
        return null;
    }

    retreatAndHeal(creep) { // TODO: make this a task
        var healPos = deref(creep.memory.data.healFlag).pos;
        return creep.moveToVisual(healPos, 'green');
    }

    run(creep) {
        // 1: retreat to heal point when injured
        if (deref(creep.memory.data.healFlag) && // if there's a heal flag
            (creep.getActiveBodyparts(TOUGH) == 0 || // if you're injured
             (creep.memory.needsHealing && creep.hits < creep.hitsMax))) { // if you're healing and not full hp
            // TODO: dps-based calculation
            creep.memory.needsHealing = true;
            return this.retreatAndHeal(creep);
        } else {
            creep.memory.needsHealing = false; // turn off when done healing
        }
        // get assignment and log replacetime
        var assignment = creep.assignment;
        if (assignment && creep.inSameRoomAs(assignment) && creep.memory.data.replaceAt == 0) {
            creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 10;
        }
        // 2: move to same room as assignment
        if (assignment && !creep.inSameRoomAs(assignment)) {
            return creep.moveToVisual(assignment.pos, 'red');
        }
        // 3: get new task if in target room
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) { // get new task
            creep.task = null;
            var target = this.findTarget(creep);
            if (target) {
                let task = tasks('dismantle');
                creep.moveToVisual(target);
                creep.assign(task, target);
            }
        }
        // execute task
        if (creep.task) {
            return creep.task.step();
        }
        // remove flag once everything is destroyed
        if (assignment && creep.room.hostileStructures.length == 0) {
            creep.log("No remaining hostile structures in room; deleting flag!");
            assignment.remove();
        }
    }
}


// var roleSieger = {
//     /** @param {Creep} creep **/
//     /** @param {StructureSpawn} spawn **/
//     /** @param {Number} creepSizeLimit **/
//
//     settings: {
//         bodyPattern: [TOUGH, WORK, MOVE],
//         ordered: true // assemble like TOUGH TOUGH WORK WORK MOVE MOVE instead of TOUGH WORK MOVE TOUGH WORK MOVE
//     },
//
//     create: function (spawn, assignment, {healFlag = null, patternRepetitionLimit = Infinity}) {
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
//         return spawn.createCreep(body, spawn.creepName('sieger'), {
//             role: 'sieger', task: null, assignment: assignment, needsHealing: false,
//             data: {origin: spawn.room.name, replaceAt: 0, healFlag: healFlag}
//         });
//     },
//
//     findTarget: function (creep) {
//         var target;
//         var targetPriority = [
//             () => creep.pos.findClosestByRange(_.filter(creep.room.flags, flagCodes.destroy.dismantle.filter)),
//             () => creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
//             () => creep.pos.findClosestByRange(
//                 FIND_HOSTILE_STRUCTURES, {filter: s => s.hits && s.structureType == STRUCTURE_TOWER}),
//             () => creep.pos.findClosestByRange(
//                 FIND_HOSTILE_STRUCTURES, {filter: s => s.hits && s.structureType != STRUCTURE_RAMPART}),
//             () => creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits})
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
//     retreatAndHeal: function (creep) {
//         var healPos = deref(creep.memory.data.healFlag).pos;
//         return creep.moveToVisual(healPos, 'green');
//     },
//
//     run: function (creep) {
//         // 1: retreat to heal point when injured
//         if (deref(creep.memory.data.healFlag) && // if there's a heal flag
//             (creep.getActiveBodyparts(TOUGH) == 0 || // if you're injured
//              (creep.memory.needsHealing && creep.hits < creep.hitsMax))) { // if you're healing and not full hp
//             creep.memory.needsHealing = true;
//             return this.retreatAndHeal(creep);
//         } else {
//             creep.memory.needsHealing = false; // turn off when done healing
//         }
//         // get assignment and log replacetime
//         var assignment = creep.assignment;
//         if (assignment && creep.inSameRoomAs(assignment) && creep.memory.data.replaceAt == 0) {
//             creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 10;
//         }
//         // 2: move to same room as assignment
//         if (assignment && !creep.inSameRoomAs(assignment)) {
//             return creep.moveToVisual(assignment.pos, 'red');
//         }
//         // 3: get new task if in target room
//         if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) { // get new task
//             creep.task = null;
//             var target = this.findTarget(creep);
//             if (target) {
//                 let task = tasks('dismantle');
//                 creep.moveToVisual(target);
//                 creep.assign(task, target);
//             }
//         }
//         // execute task
//         if (creep.task) {
//             return creep.task.step();
//         }
//         // remove flag once everything is destroyed
//         if (assignment && creep.room.hostileStructures.length == 0) {
//             creep.log("No remaining hostile structures in room; deleting flag!");
//             assignment.remove();
//         }
//     }
// };

module.exports = roleSieger;