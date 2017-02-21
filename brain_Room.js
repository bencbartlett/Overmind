// Room brain: processes tasks from room and requests from worker body
var tasks = require('tasks');

var RoomBrain = class {
    constructor(roomName) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.spawn = this.room.find(FIND_MY_SPAWNS)[0];
        // if (this.spawn == undefined) {
        //     this.spawn = this.borrowSpawn();
        // }
        // Settings shared across all rooms
        this.settings = {
            fortifyLevel: 30000, // fortify all walls/ramparts to this level
            workerPatternRepetitionLimit: 5, // maximum number of body repetitions for workers
            supplierPatternRepetitionLimit: 2, // maximum number of body repetitions for suppliers
            haulerPatternRepetitionLimit: 5, // maximum number of body repetitions for haulers
            minersPerSource: 1, // number of miners to assign to a source
            haulersPerSource: 2 // number of haulers to assign to a source
        };
        // Task priorities
        this.taskPriorities = [
            'supplyTowers',
            'supply',
            'pickup',
            'repair',
            'build',
            'fortify',
            'upgrade'
        ];
        // Tasks to execute for each prioritized task
        this.taskToExecute = {
            'pickup': 'pickup',
            'supplyTowers': 'transferEnergy',
            'supply': 'transferEnergy',
            'repair': 'repair',
            'build': 'build',
            'fortify': 'fortify',
            'upgrade': 'upgrade'
        };
        // Task role conditions
        this.assignmentRoles = {
            'pickup': ['supplier', 'hauler'],
            'supplyTowers': ['supplier', 'hauler'],
            'supply': ['supplier', 'hauler'],
            'repair': ['worker', 'miner'],
            'build': ['worker', 'miner'],
            'fortify': ['worker'],
            'upgrade': ['worker']
        };
        // Task assignment conditions
        this.assignmentConditions = {
            'pickup': creep => creep.getActiveBodyparts(CARRY) > 0 && creep.carry.energy < creep.carryCapacity,
            'supplyTowers': creep => creep.getActiveBodyparts(CARRY) > 0,
            'supply': creep => creep.getActiveBodyparts(CARRY) > 0,
            'repair': creep => creep.getActiveBodyparts(WORK) > 0,
            'build': creep => creep.getActiveBodyparts(WORK) > 0,
            'fortify': creep => creep.getActiveBodyparts(WORK) > 0,
            'upgrade': creep => creep.getActiveBodyparts(WORK) > 0
        }
    }

    getTasks() {
        var prioritizedTasks = {};
        // Priority: (can be switched with DEFCON system)
        // 0: Defense (to be implemented)
        // 1: Handle source miners/suppliers
        // 2: Pick up energy
        prioritizedTasks['pickup'] = this.room.find(FIND_DROPPED_ENERGY);
        // Find towers in need of energy
        prioritizedTasks['supplyTowers'] = this.room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType == STRUCTURE_TOWER &&
                                   structure.energy < structure.energyCapacity
        });
        // Find structures in need of energy
        prioritizedTasks['supply'] = this.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN) &&
                                   structure.energy < structure.energyCapacity
        });
        // 3: Repair structures
        prioritizedTasks['repair'] = this.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax &&
                           s.isTargeted('repairer') == false &&
                           s.structureType != STRUCTURE_CONTAINER && // containers are repaired by miners
                           s.structureType != STRUCTURE_WALL && // walls are fortify tasks
                           s.structureType != STRUCTURE_RAMPART &&
                           (s.structureType != STRUCTURE_ROAD || s.hits < 0.2 * s.hitsMax) // roads repaired as you go
        });
        // 4: Build construction jobs
        prioritizedTasks['build'] = this.room.find(FIND_CONSTRUCTION_SITES);
        // 5: Fortify walls
        prioritizedTasks['fortify'] = this.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits < this.settings.fortifyLevel &&
                           (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
        });
        // 6: Upgrade controller
        prioritizedTasks['upgrade'] = [this.room.controller.my && this.room.controller]; // can't upgrade reservations
        // To within some spatial limit, creeps should always take highest priority task regardless of room.
        return prioritizedTasks;
    }

    assignTask(creep) {
        var prioritizedTasks = this.getTasks();
        for (let task of this.taskPriorities) { // loop through tasks in descending priority
            // If task exists and can be assigned to this creep, then do so
            if (prioritizedTasks[task].length > 0 &&
                this.assignmentRoles[task].includes(creep.memory.role) &&
                this.assignmentConditions[task](creep)) {
                var taskToExecute = this.taskToExecute[task];
                var target = creep.pos.findClosestByPath(prioritizedTasks[task], {
                    // filter: (roomObject) => roomObject != null &&
                    //                         roomObject.taskedCreeps != undefined &&
                    //                         roomObject.taskedCreeps.length < taskToExecute.maxPerTarget
                });
                if (target) {
                    creep.assign(tasks(taskToExecute), target);
                    return OK;
                }
            }
        }
        // creep.log("could not get assignment from room brain!");
    }

    calculateCreepRequirements() {
        // Calculate needed numbers of workers
        // TODO: better calculation of worker requirements
        // // Case 1: if room has storage, use average storage fullness as indicator
        // if (this.room.storage) {
        //     if (this.room.storage.store[RESOURCE_ENERGY] > 0) {
        //
        //     }
        // }
        // // Case 2: if room has no storage, ...?
        if (this.spawn) {
            var energy = this.room.energyCapacityAvailable;
            var workerBodyPattern = require('role_worker').settings.bodyPattern;
            var workerSize = Math.min(Math.floor(energy / this.spawn.cost(workerBodyPattern)),
                                      this.settings.workerPatternRepetitionLimit);
            var upgradeEnergyPerTick = workerSize * 1.5; // slightly overestimate energy requirements for leeway
            var sourceEnergyPerTick = (3000 / 300) * this.room.find(FIND_SOURCES).length;
            return Math.floor(sourceEnergyPerTick / upgradeEnergyPerTick);
        } else {
            return 0;
        }
    }

    handleSources() {
        var sources = this.room.find(FIND_SOURCES); // don't use ACTIVE_SOURCES; need to always be handled
        for (let source of sources) {
            // TODO: calculation of number of miners to assign to each source based on max size of creep
            // Check enough miners are supplied
            let assignedMiners = _.filter(source.assignedCreeps,
                                          creep => creep.memory.role == 'miner' &&
                                                   creep.memory.data.replaceNow == false);
            if (assignedMiners.length < this.settings.minersPerSource) {
                // spawn a new miner that will ask for an assignment on birth
                var minerBehavior = require('role_miner');
                if (this.spawn) {
                    let newMiner = minerBehavior.create(this.spawn, source.id, {serviceRoom: this.room.name});
                    return OK;
                } else {
                    borrowedSpawn = this.borrowSpawn();
                    if (borrowedSpawn) {
                        let newMiner = minerBehavior.create(borrowedSpawn, source.id, {serviceRoom: this.room.name});
                        return OK;
                    } else {
                        return ERR_NO_SPAWN_IN_ROOM;
                    }
                }
            }
            if (this.room.storage != undefined) {
                // Check enough haulers are supplied
                let assignedHaulers = _.filter(source.assignedCreeps,
                                               creep => creep.memory.role == 'hauler');
                // var assignedContainer = source.pos.findClosestByRange(FIND_STRUCTURES, {
                //     filter: (s) => s.structureType == STRUCTURE_CONTAINER
                // });
                if (assignedHaulers.length < this.settings.haulersPerSource) {
                    // spawn a new miner that will ask for an assignment on birth
                    var haulerBehavior = require('role_hauler');
                    if (this.spawn) {
                        let newHauler = haulerBehavior.create(this.spawn, source.id, {
                            serviceRoom: this.room.name,
                            patternRepetitionLimit: this.settings.haulerPatternRepetitionLimit});
                        return OK;
                    } else {
                        borrowedSpawn = this.borrowSpawn();
                        if (borrowedSpawn) {
                            let newHauler = haulerBehavior.create(borrowedSpawn, source.id, {
                                serviceRoom: this.room.name,
                                patternRepetitionLimit: this.settings.haulerPatternRepetitionLimit});
                            return OK;
                        } else {
                            return ERR_NO_SPAWN_IN_ROOM;
                        }
                    }
                }
            }
        }
    }

    borrowSpawn(roomName = "W19N88") {
        // If another room is at full capacity, lets you borrow their spawn to spawn stuff
        var otherBrain = Game.rooms[roomName].brain;
        if (otherBrain.room.energyAvailable == otherBrain.room.energyCapacityAvailable) {
            console.log("Borrowing brain from " + roomName);
            return otherBrain.spawn;
        }
    }

    lendSpawn(roomName = "") {

    }

    // TODO: safe mode

    run() { // list of things executed each tick
        // Handle suppliers - should always be first in queue
        var numSuppliers = _.filter(Game.creeps,
                                    creep => creep.memory.role == 'supplier' &&
                                             creep.memory.data.serviceRoom == this.room.name).length;
        if (numSuppliers < 2) {
            var supplierBehavior = require('role_supplier');
            if (this.spawn) {
                var newSupplier = supplierBehavior.create(this.spawn, {
                    serviceRoom: this.room.name,
                    patternRepetitionLimit: this.settings.supplierPatternRepetitionLimit
                });
                return OK;
            } else {
                return ERR_NO_SPAWN_IN_ROOM;
            }
        }
        // Handle miners and haulers
        if (this.handleSources() == OK) {
            return OK;
        }
        // Handle workers
        var numWorkers = _.filter(Game.creeps,
                                  creep => creep.memory.role == 'worker' &&
                                           creep.memory.data.serviceRoom == this.room.name).length;
        if (numWorkers < this.calculateCreepRequirements()) {
            var workerBehavior = require('role_worker');
            if (this.spawn) {
                var newWorker = workerBehavior.create(this.spawn, {
                    serviceRoom: this.room.name,
                    patternRepetitionLimit: this.settings.workerPatternRepetitionLimit
                });
                console.log(newWorker);
                return OK;
            } else {
                return ERR_NO_SPAWN_IN_ROOM;
            }
        }
    }
};


module.exports = RoomBrain;