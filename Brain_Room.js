// Room brain: processes tasks from room and requests from worker body
var tasks = require('tasks');
var flagCodes = require('map_flag_codes');

// TODO: plug in Room.findCached() into this

var RoomBrain = class {
    constructor(roomName) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.spawn = this.room.find(FIND_MY_SPAWNS)[0];
        // Settings shared across all rooms
        this.settings = {
            fortifyLevel: 100000, // fortify all walls/ramparts to this level
            workerPatternRepetitionLimit: 5, // maximum number of body repetitions for workers
            supplierPatternRepetitionLimit: 2, // maximum number of body repetitions for suppliers
            haulerPatternRepetitionLimit: 7, // maximum number of body repetitions for haulers
            remoteHaulerPatternRepetitionLimit: 8, // maximum number of body repetitions for haulers
            minersPerSource: 1, // number of miners to assign to a source
            storageBuffer: 10000, // workers can't withdraw from storage until this level
            reserveBuffer: 4000 // reserve rooms to this amount
        };
        // Settings to override this.settings for a particular room
        this.override = {
            workersPerRoom: { // custom number of workers per room
                // "W18N88": 3,
                "W19N88": 3,
            },
            fortifyLevel: {"W18N88": 1000000}, // fortify all walls/ramparts to these levels in these rooms
        };
        // Task priorities - the actual priority the tasks are given. Everything else depends on this order
        this.taskPriorities = [
            'supplyTowers',
            'supply',
            'pickup',
            'collect',
            'repair',
            'build',
            'buildRoads',
            'fortify',
            'upgrade'
        ];
        // Tasks to execute for each prioritized task
        this.taskToExecute = {
            'pickup': 'pickup',
            'collect': 'recharge',
            'supplyTowers': 'supply',
            'supply': 'supply',
            'repair': 'repair',
            'build': 'build',
            'buildRoads': 'build',
            'fortify': 'fortify',
            'upgrade': 'upgrade'
        };
        // Task role conditions
        this.assignmentRoles = {
            'pickup': ['supplier', 'hauler'],
            'collect': ['supplier', 'hauler'],
            'supplyTowers': ['supplier', 'hauler'],
            'supply': ['supplier', 'hauler'],
            'repair': ['worker', 'miner'],
            'build': ['worker', 'miner'],
            'buildRoads': ['worker'],
            'fortify': ['worker'],
            'upgrade': ['worker']
        };
        // Task assignment conditions
        this.assignmentConditions = {
            'pickup': creep => creep.getActiveBodyparts(CARRY) > 0 && creep.carry.energy < creep.carryCapacity,
            'collect': creep => creep.getActiveBodyparts(CARRY) > 0 && creep.carry.energy < creep.carryCapacity,
            'supplyTowers': creep => creep.getActiveBodyparts(CARRY) > 0 && creep.carry.energy > 0,
            'supply': creep => creep.getActiveBodyparts(CARRY) > 0 && creep.carry.energy > 0,
            'repair': creep => creep.getActiveBodyparts(WORK) > 0 && creep.carry.energy > 0,
            'build': creep => creep.getActiveBodyparts(WORK) > 0 && creep.carry.energy > 0,
            'buildRoads': creep => creep.getActiveBodyparts(WORK) > 0 && creep.carry.energy > 0,
            'fortify': creep => creep.getActiveBodyparts(WORK) > 0 && creep.carry.energy > 0,
            'upgrade': creep => creep.getActiveBodyparts(WORK) > 0 && creep.carry.energy > 0
        };
    }

    log(message) {
        console.log(this.name + '_Brain: "' + message + '"');
    }

    get memory() {
        if (!Memory.roomBrain[this.name]) {
            Memory.roomBrain[this.name] = {};
        }
        return Memory.roomBrain[this.name];
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

    // getTasks(tasksToGet) {
    //     var prioritizedTargets = {};
    //     for (let task of tasksToGet) {
    //         switch (task) {
    //             case 'pickup': // Pick up energy
    //                 prioritizedTargets['pickup'] = this.room.find(FIND_DROPPED_ENERGY, {filter: d => d.amount > 100});
    //                 break;
    //             case 'supplyTowers': // Find towers in need of energy
    //                 prioritizedTargets['supplyTowers'] = this.room.find(FIND_MY_STRUCTURES, {
    //                     filter: (structure) => structure.structureType == STRUCTURE_TOWER &&
    //                                            structure.energy < structure.energyCapacity
    //                 });
    //                 break;
    //             case 'supply': // Find structures in need of energy
    //                 prioritizedTargets['supply'] = this.room.find(FIND_MY_STRUCTURES, {
    //                     filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION ||
    //                                             structure.structureType == STRUCTURE_SPAWN) &&
    //                                            structure.energy < structure.energyCapacity
    //                 });
    //                 break;
    //             case 'repair': // Repair structures
    //                 prioritizedTargets['repair'] = this.room.find(FIND_STRUCTURES, {
    //                     filter: (s) => s.hits < s.hitsMax &&
    //                                    s.structureType != STRUCTURE_CONTAINER && // containers are repaired by miners
    //                                    s.structureType != STRUCTURE_WALL && // walls are fortify tasks
    //                                    s.structureType != STRUCTURE_RAMPART &&
    //                                    (s.structureType != STRUCTURE_ROAD || s.hits < 0.2 * s.hitsMax)
    //                 });
    //                 break;
    //             case 'build': // Build construction jobs
    //                 prioritizedTargets['build'] = this.room.find(FIND_CONSTRUCTION_SITES, {
    //                     filter: c => c.structureType != STRUCTURE_ROAD
    //                 });
    //                 break;
    //             case 'buildRoads': // Build construction jobs
    //                 prioritizedTargets['buildRoads'] = this.room.find(FIND_CONSTRUCTION_SITES, {
    //                     filter: c => c.structureType == STRUCTURE_ROAD
    //                 });
    //                 break;
    //             case 'fortify': // Fortify walls
    //                 var fortifyLevel = this.settings.fortifyLevel; // global fortify level
    //                 if (this.override.fortifyLevel[this.room.name]) {
    //                     fortifyLevel = this.override.fortifyLevel[this.room.name]; // override for certain rooms
    //                 }
    //                 //noinspection JSReferencingMutableVariableFromClosure
    //                 prioritizedTargets['fortify'] = this.room.find(FIND_STRUCTURES, {
    //                     filter: (s) => s.hits < fortifyLevel &&
    //                                    (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
    //                 });
    //                 break;
    //             case 'upgrade': // Upgrade controller
    //                 prioritizedTargets['upgrade'] = [this.room.controller.my && this.room.controller];
    //                 break;
    //         }
    //     }
    //     return prioritizedTargets;
    // }

    getMostUrgentTask(tasksToGet) {
        // TODO: use task.maxPerTask properties to coordinate task assignment
        // TODO: defense
        // TODO: task.maxPerTarget isn't working properly all the time
        for (let task of tasksToGet) {
            var targets;
            switch (task) {
                case 'pickup': // Pick up energy
                    targets = this.room.find(FIND_DROPPED_ENERGY, {filter: d => d.amount > 100});
                    break;
                case 'collect': // Collect from containers
                    targets = this.room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType == STRUCTURE_CONTAINER &&
                                     s.store[RESOURCE_ENERGY] > 1000
                    });
                    break;
                case 'supplyTowers': // Find towers in need of energy
                    targets = this.room.find(FIND_MY_STRUCTURES, {
                        filter: (structure) => structure.structureType == STRUCTURE_TOWER &&
                                               structure.energy < structure.energyCapacity
                    });
                    break;
                case 'supply': // Find structures in need of energy
                    targets = this.room.find(FIND_MY_STRUCTURES, {
                        filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN) &&
                                               structure.energy < structure.energyCapacity
                    });
                    break;
                case 'repair': // Repair structures
                    targets = this.room.find(FIND_STRUCTURES, {
                        filter: (s) => s.hits < s.hitsMax &&
                                       s.structureType != STRUCTURE_CONTAINER && // containers are repaired by miners
                                       s.structureType != STRUCTURE_WALL && // walls are fortify tasks
                                       s.structureType != STRUCTURE_RAMPART &&
                                       (s.structureType != STRUCTURE_ROAD || s.hits < 0.2 * s.hitsMax)
                    });
                    break;
                case 'build': // Build construction jobs
                    targets = this.room.find(FIND_CONSTRUCTION_SITES, {
                        filter: c => c.structureType != STRUCTURE_ROAD
                    });
                    break;
                case 'buildRoads': // Build construction jobs
                    targets = this.room.find(FIND_CONSTRUCTION_SITES, {
                        filter: c => c.structureType == STRUCTURE_ROAD
                    });
                    break;
                case 'fortify': // Fortify walls
                    var fortifyLevel = this.settings.fortifyLevel; // global fortify level
                    if (this.override.fortifyLevel[this.room.name]) {
                        fortifyLevel = this.override.fortifyLevel[this.room.name]; // override for certain rooms
                    }
                    //noinspection JSReferencingMutableVariableFromClosure
                    targets = this.room.find(FIND_STRUCTURES, {
                        filter: (s) => s.hits < fortifyLevel &&
                                       (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
                    });
                    break;
                case 'upgrade': // Upgrade controller
                    targets = [this.room.controller.my && this.room.controller];
                    break;
            }
            // remove targets that are already targeted by too many creeps
            var taskToExecute = tasks(this.taskToExecute[task]); // create task object
            //noinspection JSReferencingMutableVariableFromClosure
            _.remove(targets, target => target.targetedBy.length > taskToExecute.maxPerTarget);
            if (targets.length > 0) { // return on the first instance of a target being found
                return [taskToExecute, targets];
            }
        }
        return [null, null];
    }

    assignTask(creep) {
        var applicableTasks = _.filter(this.taskPriorities,
                                       task => this.assignmentRoles[task].includes(creep.memory.role) &&
                                               this.assignmentConditions[task](creep));
        var [task, targets] = this.getMostUrgentTask(applicableTasks);
        // Assign the task
        if (targets) {
            var target = creep.pos.findClosestByRange(targets); // bug: some tasks aren't assigned for findClosestByPath
            creep.assign(task, target);
            this.log("assigned " + task.name + " for " + target);
            return OK;
        } else {
            if (creep.memory.role != 'supplier') { // suppliers can shut the fuck up
                creep.log("could not get assignment from room brain!");
            }
        }
    }

    calculateWorkerRequirements() {
        // Calculate needed numbers of workers
        // TODO: better calculation of worker requirements
        var spawn = this.spawn;
        if (spawn == undefined) {
            spawn = this.peekSpawn();
        }
        if (spawn) {
            if (this.override.workersPerRoom[this.name]) {
                return this.override.workersPerRoom[this.name]
            }
            var energy = spawn.room.energyCapacityAvailable;
            var workerBodyPattern = require('role_worker').settings.bodyPattern;
            var workerSize = Math.min(Math.floor(energy / spawn.cost(workerBodyPattern)),
                                      this.settings.workerPatternRepetitionLimit);
            var equilibriumEnergyPerTick = workerSize;
            if (this.room.storage == undefined) {
                equilibriumEnergyPerTick /= 3; // workers spend a lot of time walking around if there's not storage
            }
            var sourceEnergyPerTick = (3000 / 300) * this.room.find(FIND_SOURCES).length;
            return Math.ceil(0.5 * sourceEnergyPerTick / equilibriumEnergyPerTick); // operate under capacity limit
        } else {
            return null;
        }
    }

    calculateHaulerRequirements(target, remote = false) {
        // Calculate needed numbers of haulers for a source
        var spawn = this.spawn;
        if (spawn == undefined) {
            spawn = this.peekSpawn();
        }
        if (spawn && this.room.storage != undefined) {
            if (target.linked && this.room.storage.linked) { // 0 for linked sources
                return 0;
            }
            var energy = spawn.room.energyCapacityAvailable;
            var haulerBodyPattern = require('role_hauler').settings.bodyPattern;
            var haulerSize;
            var tripLength;
            if (!remote) {
                haulerSize = Math.min(Math.floor(energy / spawn.cost(haulerBodyPattern)),
                                      this.settings.haulerPatternRepetitionLimit);
                tripLength = 2 * target.pathLengthToStorage;
            } else {
                haulerSize = Math.min(Math.floor(energy / spawn.cost(haulerBodyPattern)),
                                      this.settings.remoteHaulerPatternRepetitionLimit);
                tripLength = 2 * target.pathLengthToAssignedRoomStorage
            }
            var carryParts = haulerSize * _.filter(haulerBodyPattern, part => part == CARRY).length;
            var energyPerTrip = 50 * carryParts;
            var energyPerTick = energyPerTrip / tripLength;
            var sourceEnergyPerTick = (3000 / 300);
            var haulersRequiredForEquilibrium = sourceEnergyPerTick / energyPerTick;
            return Math.ceil(1.2 * haulersRequiredForEquilibrium); // slightly overestimate
        } else {
            return null;
        }
    }

    handleMiners() {
        var sources = this.room.find(FIND_SOURCES); // don't use ACTIVE_SOURCES; need to always be handled
        for (let source of sources) {
            // TODO: calculation of number of miners to assign to each source based on max size of creep
            // Check enough miners are supplied
            let assignedMiners = _.filter(source.assignedCreeps,
                                          creep => creep.memory.role == 'miner' &&
                                                   creep.ticksToLive > creep.memory.data.replaceAt);
            if (assignedMiners.length < this.settings.minersPerSource) {
                var minerBehavior = require('role_miner');
                if (this.spawn == undefined) { // attempt to borrow other spawn; this.spawn == undefined if not able
                    this.borrowSpawn();
                }
                if (this.spawn) {
                    let newMiner = minerBehavior.create(this.spawn, source.ref, {workRoom: this.room.name});
                    return newMiner;
                }
            }
        }
        return OK;
    }

    handleHaulers() {
        // Check enough haulers are supplied
        if (this.room.storage != undefined) { // haulers are only built once a room has storage
            // find all unlinked sources
            var sources = this.room.find(FIND_SOURCES, {
                filter: source => source.linked == false || this.room.storage.linked == false
            });
            for (let source of sources) {
                // Check enough haulers are supplied if applicable
                let assignedHaulers = _.filter(source.assignedCreeps,
                                               creep => creep.memory.role == 'hauler');
                if (assignedHaulers.length < this.calculateHaulerRequirements(source)) {
                    var haulerBehavior = require('role_hauler');
                    if (this.spawn == undefined) {
                        this.borrowSpawn();
                    }
                    if (this.spawn) {
                        let newHauler = haulerBehavior.create(this.spawn, source.ref, {
                            workRoom: this.room.name,
                            patternRepetitionLimit: this.settings.haulerPatternRepetitionLimit
                        });
                        return newHauler;
                    }
                }
            }
        }
        return OK;
    }

    handleLinkers() {
        // Check enough haulers are supplied
        if (this.room.storage != undefined && this.room.storage.linked) { // linkers only for storage with links
            // Check enough haulers are supplied if applicable
            let assignedLinkers = _.filter(this.room.storage.assignedCreeps,
                                           creep => creep.memory.role == 'linker');
            if (assignedLinkers.length < 1) {
                var linkerBehavior = require('role_linker');
                let newLinker = linkerBehavior.create(this.spawn, this.room.storage.ref, {
                    workRoom: this.room.name
                });
                return newLinker;
            }
        }
        return OK;
    }

    handleSuppliers() {
        // Handle suppliers
        var numSuppliers = _.filter(Game.creeps,
                                    creep => creep.memory.role == 'supplier' &&
                                             creep.workRoom == this.room &&
                                             creep.ticksToLive > creep.memory.data.replaceAt).length;
        var energySinks = this.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType == STRUCTURE_TOWER ||
                                    structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN)
        });
        if (energySinks.length <= 1) {
            return OK;
        }
        var supplierLimit = 1; // there must always be at least one supplier in the room
        if (this.room.storage && _.filter(energySinks, s => s.energy < s.energyCapacity).length > 0) {
            supplierLimit += 1;
        }
        var expensiveFlags = _.filter(this.room.assignedFlags, flag => flagCodes.millitary.filter(flag) ||
                                                                       flagCodes.destroy.filter(flag) ||
                                                                       flagCodes.industry.filter(flag) ||
                                                                       flagCodes.territory.filter(flag));
        supplierLimit += Math.floor(expensiveFlags.length / 5); // add more suppliers for cases of lots of flags // TODO: better metric
        if (numSuppliers < supplierLimit) {
            var supplierBehavior = require('role_supplier');
            if (this.spawn == undefined) {
                this.borrowSpawn();
            }
            if (this.spawn) {
                var newSupplier = supplierBehavior.create(this.spawn, {
                    workRoom: this.room.name,
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
                                           creep.workRoom == this.room).length;
        var containers = this.room.find(FIND_STRUCTURES, {
            filter: structure => (structure.structureType == STRUCTURE_CONTAINER ||
                                  structure.structureType == STRUCTURE_STORAGE)
        });
        // Only spawn workers once containers are up
        var workerRequirements = this.calculateWorkerRequirements();
        if (workerRequirements && numWorkers < workerRequirements && containers.length > 0) {
            var workerBehavior = require('role_worker');
            if (this.spawn == undefined) {
                this.borrowSpawn();
            }
            if (this.spawn) {
                var newWorker = workerBehavior.create(this.spawn, {
                    workRoom: this.room.name,
                    patternRepetitionLimit: this.settings.workerPatternRepetitionLimit
                });
                return newWorker;
            }
        }
        return OK;
    }

    handleRemoteMiners() {
        var sourceFlags = _.filter(this.room.assignedFlags, flagCodes.industry.mine.filter);
        for (let sourceFlag of sourceFlags) {
            let assignedMiners = _.filter(sourceFlag.assignedCreeps,
                                          creep => creep.memory.role == 'miner' &&
                                                   creep.ticksToLive > creep.memory.data.replaceAt);
            let numConstructionSites = 0;
            if (sourceFlag.room) {
                numConstructionSites = sourceFlag.room.find(FIND_MY_CONSTRUCTION_SITES).length;
            }
            // add additional miners during initial construction phase
            let remoteMinersPerSource = this.settings.minersPerSource * (1 + Math.floor(numConstructionSites / 5));
            if (assignedMiners.length < remoteMinersPerSource) {
                var minerBehavior = require('role_miner');
                let newMiner = minerBehavior.create(this.spawn, sourceFlag.ref, {
                    remote: true,
                    workRoom: null
                });
                return newMiner;
            }
        }
        return OK;
    }

    handleRemoteHaulers() {
        if (this.room.storage != undefined) { // haulers are only built once a room has storage
            var sourceFlags = _.filter(this.room.assignedFlags, flagCodes.industry.mine.filter);
            for (let sourceFlag of sourceFlags) {
                let assignedHaulers = _.filter(sourceFlag.assignedCreeps,
                                               creep => creep.memory.role == 'hauler');
                // remote haulers should only be spawned for nearly complete (reserved) rooms
                let numConstructionSites = 0;
                if (sourceFlag.room) {
                    numConstructionSites = sourceFlag.room.find(FIND_MY_CONSTRUCTION_SITES).length;
                }
                if (assignedHaulers.length < this.calculateHaulerRequirements(sourceFlag, true) &&
                    numConstructionSites < 3) {
                    var haulerBehavior = require('role_hauler');
                    let newRemoteHauler = haulerBehavior.create(this.spawn, sourceFlag.ref, {
                        remote: true,
                        workRoom: this.room.name,
                        patternRepetitionLimit: this.settings.remoteHaulerPatternRepetitionLimit
                    });
                    return newRemoteHauler;
                }
            }
        }
        return OK;
    }

    handleScouts() {
        var scoutFlags = _.filter(this.room.assignedFlags, flagCodes.vision.stationary.filter);
        for (let scoutFlag of scoutFlags) {
            let assignedScouts = _.filter(scoutFlag.assignedCreeps,
                                          creep => creep.memory.role == 'scout' &&
                                                   creep.ticksToLive > creep.memory.data.replaceAt);
            if (assignedScouts.length < 1) {
                var scoutBehavior = require('role_scout');
                let newScout = scoutBehavior.create(this.spawn, scoutFlag.ref);
                return newScout;
            }
        }
        return OK;
    }

    handleReservers() {
        var reserverFlags = _.filter(this.room.assignedFlags, flagCodes.territory.reserve.filter);
        for (let reserverFlag of reserverFlags) {
            let assignedReservers = _.filter(reserverFlag.assignedCreeps,
                                             creep => creep.memory.role == 'reserver' &&
                                                      creep.ticksToLive > creep.memory.data.replaceAt);
            let reserveAgain = false;
            if (reserverFlag.room) {
                reserveAgain = !reserverFlag.room.controller.reservation ||
                               reserverFlag.room.controller.reservation.ticksToEnd < this.settings.reserveBuffer;
            }
            if (assignedReservers.length < 1 && reserveAgain) {
                var reserverBehavior = require('role_reserver');
                let newReserver = reserverBehavior.create(this.spawn, reserverFlag.ref);
                return newReserver;
            }
        }
        return OK;
    }

    handleGuards() { // TODO: migrate these flag-based functions to Brain_Flag.js
        var guardFlags = _.filter(this.room.assignedFlags, flagCodes.millitary.guard.filter);
        for (let guardFlag of guardFlags) {
            let assignedGuards = _.filter(guardFlag.assignedCreeps,
                                          creep => creep.memory.role == 'guard' &&
                                                   creep.ticksToLive > creep.memory.data.replaceAt);
            let numGuards = 1;
            if (guardFlag.memory.amount) {
                numGuards = guardFlag.memory.amount;
            }
            if (assignedGuards.length < numGuards) {
                var guardBehavior = require('role_guard');
                let newGuard = guardBehavior.create(this.spawn, guardFlag.ref);
                return newGuard;
            }
        }
        return OK;
    }

    handleSiegers() {
        var siegerFlags = _.filter(this.room.assignedFlags, flagCodes.millitary.sieger.filter);
        for (let siegerFlag of siegerFlags) {
            let assignedSiegers = _.filter(siegerFlag.assignedCreeps,
                                           creep => creep.memory.role == 'sieger' &&
                                                    creep.ticksToLive > creep.memory.data.replaceAt);
            let numSiegers = 1;
            if (siegerFlag.memory.amount) {
                numSiegers = siegerFlag.memory.amount;
            }
            if (assignedSiegers.length < numSiegers) {
                var siegerBehavior = require('role_sieger');
                let newSieger = siegerBehavior.create(this.spawn, siegerFlag.ref, {
                    healFlag: "Siege1HealPoint", // TODO: this is hardwired
                    patternRepetitionLimit: Infinity
                });
                return newSieger;
            }
        }
        return OK;
    }

    handleCreeps() {
        var handleResponse;
        var handlerPriorities = [ // TODO: _.chain() ?
            () => this.handleSuppliers(),
            () => this.handleMiners(),
            () => this.handleLinkers(),
            () => this.handleHaulers(),
            () => this.handleWorkers(),
            () => this.handleScouts(),
            () => this.handleReservers(),
            () => this.handleRemoteMiners(),
            () => this.handleRemoteHaulers(),
            () => this.handleGuards(),
            () => this.handleSiegers()
        ];

        for (let handler of handlerPriorities) {
            handleResponse = handler();
            if (handleResponse != OK) {
                return handleResponse;
            }
        }
    }

    handleSafeMode() {
        var criticalBarriers = this.room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART) &&
                           s.hits < 5000
        });
        if (criticalBarriers.length > 0 && this.room.hostiles.length > 0) {
            this.room.controller.activateSafeMode();
        }
    }

    // List of things executed each tick; only run for rooms that are owned
    run() {
        this.handleSafeMode();
        this.handleCreeps(); // build creeps as needed
    }
};


module.exports = RoomBrain;