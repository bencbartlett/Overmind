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
            workerPatternRepetitionLimit: 10, // maximum number of body repetitions for workers
            maxWorkersPerRoom: 3, // maximum number of workers to spawn per room based on number of required jobs
            supplierPatternRepetitionLimit: 4, // maximum number of body repetitions for suppliers
            haulerPatternRepetitionLimit: 7, // maximum number of body repetitions for haulers
            remoteHaulerPatternRepetitionLimit: 8, // maximum number of body repetitions for haulers
            minersPerSource: 1, // number of miners to assign to a source
            storageBuffer: 50000, // workers can't withdraw from storage until this level
            upgradeBuffer: 75000, // upgraders start scaling off of this level
            reserveBuffer: 4000 // reserve rooms to this amount
        };
        // Settings to override this.settings for a particular room
        this.override = {
            workersPerRoom: { // custom number of workers per room
                // "W18N88": 2,
                // "W19N88": 5,
            },
            fortifyLevel: {"W18N88": 2 * Math.pow(10, 6)}, // fortify all walls/ramparts to these levels in these rooms
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
            'repair': ['worker', 'miner', 'guard'],
            'build': ['worker', 'miner'],
            'buildRoads': ['worker', 'guard'],
            'fortify': ['worker'],
            'upgrade': ['worker', 'upgrader']
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

    get memory() {
        if (!Memory.roomBrain[this.name]) {
            Memory.roomBrain[this.name] = {};
        }
        return Memory.roomBrain[this.name];
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
                                       (s.structureType != STRUCTURE_ROAD || s.hits < 0.5 * s.hitsMax)
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
                    if (this.room.controller && this.room.controller.my) {
                        targets = [this.room.controller];
                    }
                    break;
            }
            if (targets) {
                var taskToExecute = tasks(this.taskToExecute[task]); // create task object
                // remove targets that are already targeted by too many creeps
                //noinspection JSReferencingMutableVariableFromClosure
                //targets = _.remove(targets, target => target.targetedBy.length > taskToExecute.maxPerTarget);
                if (targets.length > 0) { // return on the first instance of a target being found
                    return [taskToExecute, targets];
                }
            }
        }
        return [null, null];
    }

    assignTask(creep) { // TODO: fix duplicate task assignments
        var applicableTasks = _.filter(this.taskPriorities,
                                       task => this.assignmentRoles[task].includes(creep.memory.role) &&
                                               this.assignmentConditions[task](creep));
        var [task, targets] = this.getMostUrgentTask(applicableTasks);
        // Assign the task
        if (targets) {
            var target = creep.pos.findClosestByRange(targets); // bug: some tasks aren't assigned for findClosestByPath
            return creep.assign(task, target);
        }
        // else {
        //     if (creep.memory.role != 'supplier') { // suppliers can shut the fuck up
        //         creep.log("could not get assignment from room brain!");
        //     }
        // }
        return null;
    }

    calculateWorkerRequirementsByEnergy() {
        // Calculate needed numbers of workers from an energetics standpoint
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
            return Math.ceil(0.8 * sourceEnergyPerTick / equilibriumEnergyPerTick); // operate under capacity limit
        } else {
            return null;
        }
    }

    calculateWorkerRequirementsByJobs() {
        // Calculate needed number of workers based on number of jobs present; used at >=RCL5
        // repair jobs
        var numRepairJobs = this.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax &&
                           s.structureType != STRUCTURE_CONTAINER && // containers are repaired by miners
                           s.structureType != STRUCTURE_WALL && // walls are fortify tasks
                           s.structureType != STRUCTURE_RAMPART &&
                           (s.structureType != STRUCTURE_ROAD || s.hits < 0.5 * s.hitsMax)
        });
        // construction jobs
        var numConstructionJobs = this.room.find(FIND_CONSTRUCTION_SITES);
        // fortify jobs
        var fortifyLevel = this.settings.fortifyLevel;
        if (this.override.fortifyLevel[this.room.name]) {
            fortifyLevel = this.override.fortifyLevel[this.room.name];
        }
        //noinspection JSReferencingMutableVariableFromClosure
        var numFortifyJobs = this.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits < fortifyLevel &&
                           (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
        });
        var numJobs = numRepairJobs + numConstructionJobs + numFortifyJobs;
        if (numJobs == 0) {
            return 0;
        } else {
            var workerBodyPattern = require('role_worker').settings.bodyPattern;
            var workerSize = Math.min(Math.floor(this.room.energyCapacityAvailable / this.spawn.cost(workerBodyPattern)),
                                      this.settings.workerPatternRepetitionLimit);
            return Math.min(Math.ceil((2 / workerSize) * numJobs), this.settings.maxWorkersPerRoom);
        }
    }

    calculateHaulerSize(target, remote = false) { // required hauler size to fully saturate a source given distance
        var haulerBodyPattern = require('role_hauler').settings.bodyPattern;
        var tripLength; // total round-trip distance, assuming full speed
        if (!remote) {
            tripLength = 2 * target.pathLengthToStorage;
        } else {
            tripLength = 2 * target.pathLengthToAssignedRoomStorage
        }
        var carryPartsPerRepetition = _.filter(haulerBodyPattern, part => part == CARRY).length; // carry parts
        var energyPerTripPerRepetition = 50 * carryPartsPerRepetition; // energy per trip per repetition of body pattern
        var energyPerTickPerRepetition = energyPerTripPerRepetition / tripLength; // energy per tick per repetition
        var sourceEnergyPerTick = (3000 / 300); // TODO: adjust for rich energy sources
        var sizeRequiredForEquilibrium = sourceEnergyPerTick / energyPerTickPerRepetition; // size a hauler needs to be
        return Math.ceil(1.1 * sizeRequiredForEquilibrium); // slightly overestimate
    }

    calculateHaulerRequirements(target, remote = false) {
        // Calculate needed numbers of haulers for a source
        var spawn = this.spawn;
        if (spawn == undefined) {
            spawn = this.peekSpawn();
        }
        if (spawn && this.room && this.room.storage) {
            if (target.linked && this.room.storage.linked) { // don't send haulers to linked sources
                return [null, null];
            }
            var haulerBodyPattern = require('role_hauler').settings.bodyPattern;
            var haulerSize = this.calculateHaulerSize(target, remote); // calculate required hauler size
            var numHaulers = 1; // 1 hauler unless it's too large
            var maxHaulerSize = Math.floor(this.room.energyCapacityAvailable / spawn.cost(haulerBodyPattern));
            if (haulerSize > maxHaulerSize) { // if hauler is too big, adjust size to max and number accordingly
                numHaulers = haulerSize / maxHaulerSize; // amount needed
                haulerSize = Math.ceil(maxHaulerSize * (numHaulers / Math.ceil(numHaulers))); // chop off excess
                numHaulers = Math.ceil(numHaulers); // amount -> integer
            }
            return [haulerSize, numHaulers];
        } else {
            return [null, null];
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
                    return minerBehavior.create(this.spawn, source.ref, {workRoom: this.room.name});
                }
            }
        }
        return null;
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
                var [haulerSize, numHaulers] = this.calculateHaulerRequirements(source);
                if (assignedHaulers.length < numHaulers) {
                    var haulerBehavior = require('role_hauler');
                    if (this.spawn == undefined) {
                        this.borrowSpawn();
                    }
                    if (this.spawn) {
                        return haulerBehavior.create(this.spawn, source.ref, {
                            workRoom: this.room.name,
                            patternRepetitionLimit: haulerSize
                        });
                    }
                }
            }
        }
        return null;
    }

    handleLinkers() {
        // Check enough haulers are supplied
        if (this.room.storage != undefined && this.room.storage.linked) { // linkers only for storage with links
            // Check enough haulers are supplied if applicable
            let assignedLinkers = _.filter(this.room.storage.assignedCreeps,
                                           creep => creep.memory.role == 'linker');
            if (assignedLinkers.length < 1) {
                var linkerBehavior = require('role_linker');
                return linkerBehavior.create(this.spawn, this.room.storage.ref, {
                    workRoom: this.room.name
                });
            }
        }
        return null;
    }

    handleSuppliers() {
        // Handle suppliers
        var numSuppliers = _.filter(Game.creeps, creep => creep.memory.role == 'supplier' &&
                                                          creep.workRoom == this.room &&
                                                          creep.ticksToLive > creep.memory.data.replaceAt).length;
        var energySinks = this.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType == STRUCTURE_TOWER ||
                                    structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN)
        });
        if (energySinks.length <= 1) { // if there's just a spawner in the room, like in RCL1 rooms
            return null;
        }
        var supplierLimit = 1; // there must always be at least one supplier in the room
        if (this.room.storage && _.filter(energySinks, s => s.energy < s.energyCapacity).length > 0) {
            supplierLimit += 1;
        }
        var expensiveFlags = _.filter(this.room.assignedFlags, flag => flagCodes.millitary.filter(flag) ||
                                                                       flagCodes.destroy.filter(flag) ||
                                                                       flagCodes.industry.filter(flag) ||
                                                                       flagCodes.territory.filter(flag));
        supplierLimit += Math.floor(expensiveFlags.length / 10); // add more suppliers for cases of lots of flags // TODO: better metric
        if (numSuppliers < supplierLimit) {
            var supplierBehavior = require('role_supplier');
            if (this.spawn == undefined) {
                this.borrowSpawn();
            }
            if (this.spawn) {
                return supplierBehavior.create(this.spawn, {
                    workRoom: this.room.name,
                    patternRepetitionLimit: this.settings.supplierPatternRepetitionLimit
                });
            }
        }
        return null;
    }

    handleWorkers() {
        var numWorkers = _.filter(Game.creeps, creep => creep.memory.role == 'worker' &&
                                                        creep.workRoom == this.room).length;
        var containers = this.room.find(FIND_STRUCTURES, {
            filter: structure => (structure.structureType == STRUCTURE_CONTAINER ||
                                  structure.structureType == STRUCTURE_STORAGE)
        });
        // Only spawn workers once containers are up
        var workerRequirements;
        if (this.room.storage) {
            workerRequirements = this.calculateWorkerRequirementsByJobs(); // switch to worker/upgrader once storage
        } else {
            workerRequirements = this.calculateWorkerRequirementsByEnergy(); // no static upgraders prior to RCL4
        }
        if (workerRequirements && numWorkers < workerRequirements && containers.length > 0) {
            var workerBehavior = require('role_worker');
            if (this.spawn == undefined) {
                this.borrowSpawn();
            }
            if (this.spawn) {
                return workerBehavior.create(this.spawn, {
                    workRoom: this.room.name,
                    patternRepetitionLimit: this.settings.workerPatternRepetitionLimit
                });
            }
        }
        return null;
    }

    handleUpgraders() {
        if (!this.room.storage) { // room needs to have storage before upgraders happen
            return null;
        }
        var numUpgraders = _.filter(Game.creeps, creep => creep.memory.role == 'upgrader' &&
                                                          creep.workRoom == this.room).length;
        if (numUpgraders < 2) {
            var amountOver = Math.max(this.room.storage.store[RESOURCE_ENERGY] - this.settings.storageBuffer, 0);
            var upgraderSize = 1 + Math.floor(amountOver / 10000);
            var upgraderBehavior = require('role_upgrader');
            if (this.spawn) {
                return upgraderBehavior.create(this.spawn, {
                    workRoom: this.room.name,
                    patternRepetitionLimit: upgraderSize
                });
            }
        }
        return null;
    }

    handleSpawnOperations() {
        if (this.spawn.spawning) { // don't bother calculating if you can't spawn anything...
            return null;
        }

        var handleResponse;
        var prioritizedDomesticOperations = [
            // Domestic operations
            () => this.handleSuppliers(), // don't move this from top
            () => this.handleLinkers(),
            () => this.handleMiners(),
            () => this.handleHaulers(),
            () => this.handleWorkers(),
            () => this.handleUpgraders(),
        ];

        // Handle domestic operations
        for (let handler of prioritizedDomesticOperations) {
            handleResponse = handler();
            if (handleResponse != null) {
                return handleResponse;
            }
        }

        let flags = this.room.assignedFlags;
        var prioritizedFlagOperations = [
            _.filter(flags, flagCodes.vision.stationary.filter),
            _.filter(flags, flagCodes.millitary.guard.filter),
            _.filter(flags, flagCodes.industry.remoteMine.filter),
            _.filter(flags, flagCodes.territory.reserve.filter),
            _.filter(flags, flagCodes.rally.healPoint.filter),
            _.filter(flags, flagCodes.millitary.sieger.filter)
        ];

        // Handle actions associated with assigned flags
        for (let flagPriority of prioritizedFlagOperations) {
            var flagsSortedByRange = _.sortBy(flagPriority, flag => flag.pathLengthToAssignedRoomStorage || Infinity);
            for (let flag of flagsSortedByRange) {
                handleResponse = flag.action(this);
                if (handleResponse != null) {
                    return handleResponse;
                }
            }
        }
    }

    handleSafeMode() { // TODO: make this better, defcon system
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
        this.handleSpawnOperations(); // build creeps as needed
    }
};


module.exports = RoomBrain;