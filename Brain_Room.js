// Room brain: processes tasks from room and requests from worker body
var tasks = require('tasks');

var RoomBrain = class {
    constructor(roomName) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.spawn = this.room.find(FIND_MY_SPAWNS)[0];
        // Brain flag - purple/purple denotes owned room, purple/grey denotes reserved room
        this.flag = this.room.controller.pos.lookFor(LOOK_FLAGS)[0];
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
            // 'migrate',
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
            // 'migrate': 'migrate',
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
            // 'migrate': ['miner', 'worker', 'supplier'], // haulers shouldn't be able to migrate
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
            // 'migrate': creep => creep.room.name != creep.memory.data.serviceRoom,
            'pickup': creep => creep.getActiveBodyparts(CARRY) > 0 && creep.carry.energy < creep.carryCapacity,
            'supplyTowers': creep => creep.getActiveBodyparts(CARRY) > 0,
            'supply': creep => creep.getActiveBodyparts(CARRY) > 0,
            'repair': creep => creep.getActiveBodyparts(WORK) > 0,
            'build': creep => creep.getActiveBodyparts(WORK) > 0,
            'fortify': creep => creep.getActiveBodyparts(WORK) > 0,
            'upgrade': creep => creep.getActiveBodyparts(WORK) > 0
        }
    }

    log(message) {
        console.log(this.name + '_Brain: "' + message + '"');
    }

    peekSpawn(roomName = "W19N88") {
        // looks at other spawn without changing this.spawn
        var otherBrain = Game.rooms[roomName].brain;
        if (otherBrain.room.energyAvailable == otherBrain.room.energyCapacityAvailable) {
            return otherBrain.spawn;
        } else {
            return null; // don't lend it out if not full
        }
    }

    borrowSpawn(roomName = "W19N88") {
        // If another room is at full capacity, lets you borrow their spawn to spawn stuff
        var otherSpawn = this.peekSpawn(roomName);
        if (otherSpawn) {
            this.log("borrowing spawn from " + roomName + "_Brain");
            this.spawn = otherSpawn;
        }
    }

    getTasks() { // TODO: use task.maxPerTarget / task.maxPerTask properties to coordinate task assignment
        var prioritizedTargets = {};
        // Priority: (can be switched with DEFCON system)
        // 0: Defense (to be implemented)
        // 1: Handle source miners/suppliers
        // Handle migrating creeps
        // prioritizedTargets['migrate'] = [this.room.controller];
        // 2: Pick up energy
        prioritizedTargets['pickup'] = this.room.find(FIND_DROPPED_ENERGY);
        // Find towers in need of energy
        prioritizedTargets['supplyTowers'] = this.room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType == STRUCTURE_TOWER &&
                                   structure.energy < structure.energyCapacity
        });
        // Find structures in need of energy
        prioritizedTargets['supply'] = this.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN) &&
                                   structure.energy < structure.energyCapacity
        });
        // 3: Repair structures
        prioritizedTargets['repair'] = this.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax &&
                           s.isTargeted('repairer') == false &&
                           s.structureType != STRUCTURE_CONTAINER && // containers are repaired by miners
                           s.structureType != STRUCTURE_WALL && // walls are fortify tasks
                           s.structureType != STRUCTURE_RAMPART &&
                           (s.structureType != STRUCTURE_ROAD || s.hits < 0.2 * s.hitsMax) // roads repaired as you go
        });
        // 4: Build construction jobs
        prioritizedTargets['build'] = this.room.find(FIND_CONSTRUCTION_SITES);
        // 5: Fortify walls
        prioritizedTargets['fortify'] = this.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits < this.settings.fortifyLevel &&
                           (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
        });
        // 6: Upgrade controller
        prioritizedTargets['upgrade'] = [this.room.controller.my && this.room.controller]; // can't upgrade reservations
        // To within some spatial limit, creeps should always take highest priority task regardless of room.
        return prioritizedTargets;
    }

    assignTask(creep) {
        var prioritizedTargets = this.getTasks();
        var roomTasks = this.room.tasks;
        var roomTaskTargets = this.room.taskTargets;
        for (let task of this.taskPriorities) { // loop through tasks in descending priority
            // If task exists and can be assigned to this creep, then do so
            if (prioritizedTargets[task].length > 0 &&
                this.assignmentRoles[task].includes(creep.memory.role) &&
                this.assignmentConditions[task](creep)) {
                var taskToExecute = tasks(this.taskToExecute[task]); // create task object
                // Find a target that isn't already targeted by the max numbers of creeps.
                //noinspection JSReferencingMutableVariableFromClosure
                var target = creep.pos.findClosestByRange(prioritizedTargets[task], {
                    filter: target => _.filter(roomTaskTargets, t => t == target).length < taskToExecute.maxPerTarget
                });
                if (target) {
                    creep.assign(taskToExecute, target);
                    this.log("assigned " + taskToExecute.name + " for " + target);
                    return OK;
                }
            }
        }
        creep.log("could not get assignment from room brain!");
    }

    calculateWorkerRequirements() {
        // Calculate needed numbers of workers
        // TODO: better calculation of worker requirements
        var spawn = this.spawn;
        if (spawn == undefined) {
            spawn = this.peekSpawn();
        }
        if (spawn) {
            var energy = spawn.room.energyCapacityAvailable;
            var workerBodyPattern = require('role_worker').settings.bodyPattern;
            var workerSize = Math.min(Math.floor(energy / spawn.cost(workerBodyPattern)),
                                      this.settings.workerPatternRepetitionLimit);
            var equilibriumEnergyPerTick = workerSize;
            if (this.room.storage == undefined) {
                equilibriumEnergyPerTick /= 3; // workers spend a lot of time walking around if there's not storage
            }
            var sourceEnergyPerTick = (3000 / 300) * this.room.find(FIND_SOURCES).length;
            return Math.ceil(0.7 * sourceEnergyPerTick / equilibriumEnergyPerTick); // operate under capacity limit
        } else {
            return null;
        }
    }

    calculateHaulerRequirements(target) {
        // Calculate needed numbers of haulers for a source
        var spawn = this.spawn;
        if (spawn == undefined) {
            spawn = this.peekSpawn();
        }
        if (spawn && this.room.storage != undefined) {
            var energy = spawn.room.energyCapacityAvailable;
            var haulerBodyPattern = require('role_hauler').settings.bodyPattern;
            var haulerSize = Math.min(Math.floor(energy / spawn.cost(haulerBodyPattern)),
                                      this.settings.haulerPatternRepetitionLimit);
            var carryParts = haulerSize * _.filter(haulerBodyPattern, part => part == CARRY).length;
            var tripLength = 2 * this.room.storage.pos.findPathTo(target).length;
            var energyPerTrip = 50 * carryParts;
            var energyPerTick = energyPerTrip / tripLength;
            var sourceEnergyPerTick = (3000 / 300);
            var haulersRequiredForEquilibrium = sourceEnergyPerTick / energyPerTick;
            return Math.ceil(1.2 * haulersRequiredForEquilibrium); // slightly overestimate
        } else {
            return null;
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
                if (this.spawn == undefined) { // attempt to borrow other spawn; this.spawn == undefined if not able
                    this.borrowSpawn();
                }
                if (this.spawn) {
                    let newMiner = minerBehavior.create(this.spawn, source.id, {serviceRoom: this.room.name});
                    return newMiner;
                }
            }
            // Check enough haulers are supplied if applicable
            if (this.room.storage != undefined) { // haulers are only built once a room has storage
                // Check enough haulers are supplied
                let assignedHaulers = _.filter(source.assignedCreeps,
                                               creep => creep.memory.role == 'hauler');
                // var assignedContainer = source.pos.findClosestByRange(FIND_STRUCTURES, {
                //     filter: (s) => s.structureType == STRUCTURE_CONTAINER
                // });
                if (assignedHaulers.length < this.calculateHaulerRequirements(source)) {
                    // spawn a new miner that will ask for an assignment on birth
                    var haulerBehavior = require('role_hauler');
                    if (this.spawn == undefined) {
                        this.borrowSpawn();
                    }
                    if (this.spawn) {
                        let newHauler = haulerBehavior.create(this.spawn, source.id, {
                            serviceRoom: this.room.name,
                            patternRepetitionLimit: this.settings.haulerPatternRepetitionLimit
                        });
                        return newHauler;
                    }
                }
            }
        }
        return OK;
    }

    handleSuppliers() {
        // Handle suppliers
        var numSuppliers = _.filter(Game.creeps,
                                    creep => creep.memory.role == 'supplier' &&
                                             creep.memory.data.serviceRoom == this.room.name).length;
        var energySinks = this.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType == STRUCTURE_TOWER ||
                                    structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN) &&
                                   structure.energy < structure.energyCapacity
        });
        var supplierLimit = 1;
        if (this.room.storage) {
            supplierLimit += 2;
        }
        if (numSuppliers < supplierLimit && energySinks.length > 0) {
            var supplierBehavior = require('role_supplier');
            if (this.spawn == undefined) {
                this.borrowSpawn();
            }
            if (this.spawn) {
                var newSupplier = supplierBehavior.create(this.spawn, {
                    serviceRoom: this.room.name,
                    patternRepetitionLimit: this.settings.supplierPatternRepetitionLimit
                });
                return newSupplier;
            }
        }
        return OK;
    }

    handleWorkers() {
        var numWorkers = _.filter(Game.creeps,
                                  creep => creep.memory.role == 'worker' &&
                                           creep.memory.data.serviceRoom == this.room.name).length;
        var containers = this.room.find(FIND_STRUCTURES, {
            filter: structure => (structure.structureType == STRUCTURE_CONTAINER ||
                                  structure.structureType == STRUCTURE_STORAGE)
        });
        // Only spawn workers once containers are up
        // console.log(this.room.name, numWorkers, this.calculateWorkerRequirements(), containers.length);
        var workerRequirements = this.calculateWorkerRequirements();
        if (workerRequirements && numWorkers < workerRequirements && containers.length > 0) {
            var workerBehavior = require('role_worker');
            if (this.spawn == undefined) {
                this.borrowSpawn();
            }
            if (this.spawn) {
                var newWorker = workerBehavior.create(this.spawn, {
                    serviceRoom: this.room.name,
                    patternRepetitionLimit: this.settings.workerPatternRepetitionLimit
                });
                // console.log(newWorker);
                return newWorker;
            }
        }
        return OK;
    }


    // TODO: safe mode

    run() { // list of things executed each tick
        var handleResponse;
        // Handle miners and haulers
        handleResponse = this.handleSources();
        if (handleResponse != OK) {
            return handleResponse;
        }
        // Handle suppliers
        handleResponse = this.handleSuppliers();
        if (handleResponse != OK) {
            return handleResponse;
        }
        // Handle workers
        handleResponse = this.handleWorkers();
        if (handleResponse != OK) {
            return handleResponse;
        }
    }
};


module.exports = RoomBrain;