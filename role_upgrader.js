// Upgrader creep - sits and upgrades spawn
var tasks = require('tasks');
var Role = require('Role');

class roleUpgrader extends Role {
    constructor() {
        super('upgrader');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, WORK, WORK, WORK, CARRY, MOVE];
        this.settings.signature = 'Overmind Screeps AI';
        this.settings.consoleQuiet = true;
        this.settings.sayQuiet = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(WORK) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    recharge(creep) { // modification to allow upgraders to upgrade if room is close to decay
        var bufferSettings = creep.room.brain.settings.storageBuffer; // not creep.workRoom; use rules of room you're in
        var buffer = bufferSettings.default;
        if (bufferSettings[this.name]) {
            buffer = bufferSettings[this.name];
        }
        // avoid room decay
        if (creep.room.controller.ticksToDowngrade < 4000) {
            buffer = 0;
        }
        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                           (s.structureType == STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > buffer)
        });
        if (target) { // assign recharge task to creep
            return creep.assign(tasks('recharge'), target);
        } else {
            if (!this.settings.consoleQuiet && this.settings.notifyOnNoRechargeTargets) {
                creep.log('no recharge targets!');
            }
            return null;
        }
    }

    onRun(creep) {
        if (!creep.workRoom.controller.sign || creep.workRoom.controller.sign.text != this.settings.signature) {
            if (creep.signController(creep.workRoom.controller, this.settings.signature) == ERR_NOT_IN_RANGE) {
                creep.moveToVisual(creep.workRoom.controller);
            }
        }
    }
}

// var roleUpgraderOld = {
//     /** @param {Creep} creep **/
//
//     settings: {
//         bodyPattern: [WORK, WORK, WORK, WORK, CARRY, MOVE],
//         signature: 'Overmind AI'
//     },
//
//     create: function (spawn, {workRoom = spawn.room.name, patternRepetitionLimit = Infinity}) {
//         /** @param {StructureSpawn} spawn **/
//         var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
//         var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
//         numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
//         // create the body
//         var body = [];
//         for (let i = 0; i < numRepeats; i++) {
//             body = body.concat(bodyPattern);
//         }
//         // create the creep and initialize memory
//         return spawn.createCreep(body, spawn.creepName('upgrader'), {
//             role: 'upgrader', workRoom: workRoom, task: null, data: {
//                 origin: spawn.room.name, replaceAt: 0
//             }
//         });
//     },
//
//     recharge: function (creep) {
//         // try to find closest container or storage
//         creep.memory.working = false;
//         if (creep.workRoom.storage.store[RESOURCE_ENERGY] > creep.workRoom.brain.settings.storageBuffer['upgrader']) {
//             return creep.assign(tasks('recharge'), creep.workRoom.storage);
//         } else {
//             return null;
//         }
//     },
//
//     newTask: function (creep) {
//         creep.task = null;
//         if (creep.carry.energy == 0) {
//             return this.recharge(creep);
//         } else {
//             return creep.workRoom.brain.assignTask(creep);
//         }
//     },
//
//     executeTask: function (creep) {
//         // execute the task
//         creep.task.step();
//     },
//
//     run: function (creep) {
//         if (creep.workRoom) {
//             // move to service room
//             if (creep.conditionalMoveToWorkRoom() != OK) {
//                 return ERR_NOT_IN_SERVICE_ROOM;
//             }
//             if (!creep.workRoom.controller.sign || creep.workRoom.controller.sign.text != this.settings.signature) {
//                 if (creep.signController(creep.workRoom.controller, this.settings.signature) == ERR_NOT_IN_RANGE) {
//                     creep.moveToVisual(creep.workRoom.controller);
//                 }
//             }
//             // get new task if this one is invalid
//             if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
//                 this.newTask(creep);
//             }
//             // execute task
//             if (creep.task) {
//                 this.executeTask(creep);
//             }
//         }
//     }
// };

module.exports = roleUpgrader;