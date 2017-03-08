// Worker creep - combines repairer, builder, and upgrader functionality
var tasks = require('tasks');
var Role = require('Role');

class roleWorker extends Role {
    constructor() {
        super('worker');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, CARRY, MOVE];
        this.settings.notifyOnNoTask = false;
        this.roleRequirements = creep => creep.getActiveBodyparts(WORK) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    onRun(creep) {
        if (creep.room.brain.incubating) {
            // only harvest if there are miners away from their stations
            this.settings.workersCanHarvest =
                creep.room.find(FIND_MY_CREEPS, {
                    filter: c => c.memory.role == 'miner' && // is a miner
                                 c.pos.findInRange(FIND_SOURCES, 1).length > 0 // is next to a source
                }).length < creep.room.sources.length; // are all sources are occupied by miners?
            this.renewIfNeeded(creep);
        }
        if (creep.conditionalMoveToWorkRoom() != OK) { // workers sometimes stray from their service rooms
            this.settings.sayQuiet = true;
            this.settings.consoleQuiet = true;
            return ERR_NOT_IN_SERVICE_ROOM;
        }
        // if a creep is trying to harvest and isn't getting any energy and a container becomes available, stop harvest
        if (creep.task && creep.task.name == 'harvest' && creep.pos.findInRange(FIND_SOURCES, 1).length == 0) {
            if (_.filter(creep.room.storageUnits,
                         s => (s.structureType == STRUCTURE_CONTAINER
                               && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                              (s.structureType == STRUCTURE_STORAGE
                               && s.store[RESOURCE_ENERGY] > creep.room.brain.settings.storageBuffer['worker'])
                ).length > 0) {
                creep.task = null;
            }
        }
        // if a creep was assigned to build an outpost room and it's done, send it back to original room
        if (creep.room.reservedByMe && creep.room.constructionSites.length == 0) {
            creep.setWorkRoom(creep.memory.data.origin);
        }
    }

    // Old harvest function in case I need it in the future
    harvest(creep) {
        var target = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE, {
            filter: (source) => source.openSpots() > 0
        });
        if (target) {
            return creep.assign(tasks('harvest'), target);
        } else {
            creep.log("no harvestable sources found!");
            return null;
        }
    }

    // Old recharge function in case I need it in the future
    recharge(creep) {
        // try to find closest container or storage
        var target;
        if (this.settings.targetFullestContainer) {
            target = creep.room.fullestContainer();
        } else {
            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s) => (s.structureType == STRUCTURE_CONTAINER
                                && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                               (s.structureType == STRUCTURE_STORAGE
                                && s.store[RESOURCE_ENERGY] > creep.room.brain.settings.storageBuffer['worker'])
            });
        }
        if (target) {
            // assign recharge task to creep
            return creep.assign(tasks('recharge'), target);
        } else {
            // if no targetable containers, see if worker can harvest
            if (this.settings.workersCanHarvest) {
                return this.harvest(creep);
            } else {
                // creep.log("no containers found and harvesting disabled!");
                return null;
            }
        }
    }

}

// var roleWorker = {
//     /** @param {Creep} creep **/
//
//     settings: {
//         bodyPattern: [WORK, CARRY, MOVE],
//         workersCanHarvest: false, // can workers act as harvesters? usually false
//         targetFullestContainer: false // if true, target fullest container instead of the closest, ignore storage
//     },
//
//     create: function (spawn, {workRoom = spawn.room.name, patternRepetitionLimit = Infinity, remote = false}) {
//         /** @param {StructureSpawn} spawn **/
//         var bodyPattern = this.settings.bodyPattern; // body pattern to be repeated some number of times
//         // calculate the most number of pattern repetitions you can use with available energy
//         var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
//         // make sure the creep is not too big (more than 50 parts)
//         numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
//         // create the body
//         var body = [];
//         for (let i = 0; i < numRepeats; i++) {
//             body = body.concat(bodyPattern);
//         }
//         // create the creep and initialize memory
//         return spawn.createCreep(body, spawn.creepName('worker'), {
//             role: 'worker', workRoom: workRoom, remote: remote, task: null, data: {
//                 origin: spawn.room.name
//             }
//         });
//     },
//
//     requestTask: function (creep) {
//         var response = creep.workRoom.brain.assignTask(creep);
//         // creep.log(response);
//         return response;
//     },
//
//     recharge: function (creep) {
//         // try to find closest container or storage
//         var target;
//         if (this.settings.targetFullestContainer) {
//             target = creep.room.fullestContainer();
//         } else {
//             target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
//                 filter: (s) => (s.structureType == STRUCTURE_CONTAINER
//                                 && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
//                                (s.structureType == STRUCTURE_STORAGE
//                                 && s.store[RESOURCE_ENERGY] > creep.room.brain.settings.storageBuffer['worker'])
//             });
//         }
//         if (target) {
//             // assign recharge task to creep
//             return creep.assign(tasks('recharge'), target);
//         } else {
//             // if no targetable containers, see if worker can harvest
//             if (this.settings.workersCanHarvest) {
//                 return this.harvest(creep);
//             } else {
//                 // creep.log("no containers found and harvesting disabled!");
//                 return null;
//             }
//         }
//     },
//
//     harvest: function (creep) {
//         var target = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE, {
//             filter: (source) => source.openSpots() > 0
//         });
//         if (target) {
//             return creep.assign(tasks('harvest'), target);
//         } else {
//             creep.log("no harvestable sources found!");
//             return null;
//         }
//     },
//
//     newTask: function (creep) {
//         creep.task = null;
//         if (creep.carry.energy == 0) {
//             return this.recharge(creep);
//         } else {
//             return this.requestTask(creep);
//         }
//     },
//
//     executeTask: function (creep) {
//         // execute the task
//         creep.task.step();
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
//         // execute task
//         if (creep.task) {
//             this.executeTask(creep);
//         }
//     }
// };

module.exports = roleWorker;