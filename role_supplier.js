// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage
var tasks = require('tasks');
var Role = require('Role');

class roleSupplier extends Role {
    constructor() {
        super('supplier');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        // this.settings.consoleQuiet = true; // suppliers should shut the fuck up
        this.settings.notifyOnNoRechargeTargets = true;
        this.settings.notifyOnNoTask = false;
        this.roleRequirements = creep => creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    create(spawn, {assignment, workRoom, patternRepetitionLimit = Infinity}) {
        let creep = this.generateLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: patternRepetitionLimit
        });
        creep.memory.data.replaceAt = 100; // replace suppliers early!
        return creep; // spawn.createCreep(creep.body, creep.name, creep.memory);
    }

    // recharge(creep) {
    //     var containers = creep.workRoom.find(FIND_STRUCTURES, {
    //         filter: (s) => s.structureType == STRUCTURE_CONTAINER
    //     });
    //     if (creep.workRoom.storage) {
    //         containers = _.filter(containers, s => s.store[RESOURCE_ENERGY] >
    //                                                this.settings.assistHaulersAtContainerPercent * s.storeCapacity);
    //     }
    //     var target;
    //     if (containers.length > 0) {
    //         let targets = _.sortBy(containers, [function (s) {
    //             return s.store[RESOURCE_ENERGY]
    //         }]);
    //         target = targets[targets.length - 1]; // pick the fullest container
    //     }
    //     if (!target) {
    //         target = creep.workRoom.storage;
    //     }
    //     if (target) {
    //         return creep.assign(tasks('recharge'), target);
    //     } else {
    //         creep.say("Idle");
    //         return null;
    //     }
    // }

    // newTask(creep) {
    //     creep.task = null;
    //     let newTask = this.requestTask(creep);
    //     if (newTask == undefined && creep.carry.energy == 0) {
    //         return this.recharge(creep);
    //     } else {
    //         return newTask;
    //     }
    // }

    run(creep) {
        // move to service room
        if (creep.conditionalMoveToWorkRoom() != OK) {
            return ERR_NOT_IN_SERVICE_ROOM;
        }
        // get new task if this one is invalid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        if (creep.task) {
            // execute task
            this.executeTask(creep);
        } else {
            if (creep.carry.energy < creep.carry.carryCapacity) {
                return this.recharge(creep); // recharge once there's nothing to do
            } else { // sit and wait at flag
                let idleFlag = _.filter(creep.room.flags, require('map_flag_codes').rally.idlePoint.filter)[0];
                if (idleFlag) {
                    // creep.moveToVisual(idleFlag);
                    creep.travelTo(idleFlag);
                }
            }
        }
    }
}

// var roleSupplierOld = {
//     /** @param {Creep} creep **/
//     /** @param {StructureSpawn} spawn **/
//     /** @param {Number} creepSizeLimit **/
//
//     settings: {
//         bodyPattern: [CARRY, CARRY, MOVE],
//         assistHaulersAtContainerPercent: 1.1 // help out haulers at >this capacity
//     },
//
//     create: function (spawn, {workRoom = spawn.room.name, patternRepetitionLimit = 3}) { // 6 or 8 parts will saturate a source
//         /** @param {StructureSpawn} spawn **/
//         var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
//         // calculate the most number of pattern repetitions you can use with available energy
//         var numRepeats = Math.floor((spawn.room.energyCapacityAvailable) / spawn.cost(bodyPattern));
//         // make sure the creep is not too big (more than 50 parts)
//         numRepeats = Math.min(Math.floor(50 / (bodyPattern.length)), numRepeats, patternRepetitionLimit);
//         // create the body
//         var body = [];
//         for (let i = 0; i < numRepeats; i++) {
//             body = body.concat(bodyPattern);
//         }
//         // static replaceAt to prevent cases where all suppliers die out at the same time
//         return spawn.createCreep(body, spawn.creepName('supplier'), {
//             role: 'supplier', workRoom: workRoom, working: false, task: null, data: {
//                 origin: spawn.room.name, replaceAt: 100
//             }
//         });
//     },
//
//     requestTask: function (creep) {
//         creep.memory.working = true;
//         return creep.workRoom.brain.assignTask(creep);
//     },
//
//     recharge: function (creep) {
//         creep.memory.working = false;
//         var recharge = tasks('recharge');
//         var containers = creep.workRoom.find(FIND_STRUCTURES, {
//             filter: (s) => s.structureType == STRUCTURE_CONTAINER
//         });
//         if (creep.workRoom.storage) {
//             containers = _.filter(containers, s => s.store[RESOURCE_ENERGY] >
//                                                    this.settings.assistHaulersAtContainerPercent * s.storeCapacity);
//         }
//         var target;
//         if (containers.length > 0) {
//             let targets = _.sortBy(containers, [function (s) {
//                 return s.store[RESOURCE_ENERGY]
//             }]);
//             target = targets[targets.length - 1]; // pick the fullest container
//         }
//         if (!target) {
//             target = creep.workRoom.storage;
//         }
//         if (target) {
//             return creep.assign(recharge, target);
//         } else {
//             creep.say("Idle");
//             return null;
//         }
//     },
//
//     newTask: function (creep) {
//         creep.task = null;
//         let newTask = this.requestTask(creep);
//         if (newTask == undefined && creep.carry.energy == 0) {
//             return this.recharge(creep);
//         } else {
//             return newTask;
//         }
//     },
//
//     executeTask: function (creep) {
//         // execute the task
//         creep.task.step()
//     },
//
//     run: function (creep) {
//         // move to service room
//         if (creep.conditionalMoveToWorkRoom() != OK) {
//             return ERR_NOT_IN_SERVICE_ROOM;
//         }
//         // get new task if this one is invalid
//         if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
//             this.newTask(creep);
//         }
//         if (creep.task) {
//             // execute task
//             this.executeTask(creep);
//         } else {
//             if (creep.carry.energy < creep.carry.carryCapacity) {
//                 return this.recharge(creep); // recharge once there's nothing to do
//             } else { // sit and wait at flag
//                 let idleFlag = _.filter(creep.room.flags, require('map_flag_codes').rally.idlePoint.filter)[0];
//                 if (idleFlag) {
//                     creep.moveToVisual(idleFlag);
//                 }
//             }
//         }
//     }
// };

module.exports = roleSupplier;