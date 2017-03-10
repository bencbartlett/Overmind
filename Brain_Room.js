// Room brain: processes tasks from room and requests from worker body
var tasks = require('tasks');
var roles = require('roles');
var flagCodes = require('map_flag_codes');

// TODO: plug in Room.findCached() into this

class RoomBrain {
    constructor(roomName) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.spawn = _.filter(this.room.spawns, spawn => !spawn.spawning)[0];
        this.incubating = (_.filter(this.room.flags, flagCodes.territory.claimAndIncubate.filter).length > 0);
        // Settings shared across all rooms
        this.settings = {
            fortifyLevel: 1e+6, // Math.min(Math.pow(10, Math.max(this.room.controller.level, 3)), 1e+6), // fortify wall HP
            workerPatternRepetitionLimit: 10, // maximum number of body repetitions for workers
            maxWorkersPerRoom: 2, // maximum number of workers to spawn per room based on number of required jobs
            incubationWorkersToSend: 3, // number of big workers to send to incubate a room
            supplierPatternRepetitionLimit: 4, // maximum number of body repetitions for suppliers
            haulerPatternRepetitionLimit: 7, // maximum number of body repetitions for haulers
            remoteHaulerPatternRepetitionLimit: 8, // maximum number of body repetitions for haulers
            minersPerSource: 1, // number of miners to assign to a source
            storageBuffer: { // creeps of a given role can't withdraw from (or not deposit to) storage until this level
                linker: 75000, // linker must deposit to storage below this amount
                worker: 50000,
                upgrader: 75000,
                default: 0
            },
            reserveBuffer: 3000, // reserve rooms to this amount
            maxAssistLifetimePercentage: 0.1 // assist in spawn operations up to (creep.lifetime * this amount) distance
        };
        // Settings for new rooms that are being incubated
        this.incubatingSettings = {
            fortifyLevel: 1e+3, // fortify all walls/ramparts to this level
            workerPatternRepetitionLimit: 10, // maximum number of body repetitions for workers
            maxWorkersPerRoom: 4, // maximum number of workers to spawn per room based on number of required jobs
            supplierPatternRepetitionLimit: 2, // maximum number of body repetitions for suppliers
            haulerPatternRepetitionLimit: 7, // maximum number of body repetitions for haulers
            remoteHaulerPatternRepetitionLimit: 8, // maximum number of body repetitions for haulers
            minersPerSource: 1, // number of miners to assign to a source
            storageBuffer: { // creeps of a given role can't withdraw from storage until this level
                worker: 1000,
                upgrader: 5000,
                default: 0
            },
            reserveBuffer: 3000 // reserve rooms to this amount
        };
        if (this.incubating) {
            this.settings = this.incubatingSettings; // overwrite settings for incubating rooms
        }
        // Settings to override this.settings for a particular room
        this.override = {
            workersPerRoom: { // custom number of workers per room
                // "W18N88": 2,
                // "W19N88": 5,
            },
            fortifyLevel: {
                // "W18N88": 2e+6
            }, // fortify all walls/ramparts to these levels in these rooms
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
            'collect': ['hauler'],
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

    // get localSpawnQueue() {
    //     if (!this.memory.spawnQueue) {
    //         this.memory.spawnQueue = {};
    //     }
    //     return this.memory.spawnQueue;
    // }
    //
    // get globalSpawnQueue() {
    //     if (!Memory.globalSpawnQueue) {
    //         Memory.globalSpawnQueue = {};
    //     }
    //     return Memory.globalSpawnQueue;
    // }

    log(message) {
        console.log(this.name + '_Brain: "' + message + '"');
    }


    // Creep task assignment ===========================================================================================

    getTasks(taskType) {
        var targets = [];
        switch (taskType) {
            case 'pickup': // Pick up energy
                targets = this.room.find(FIND_DROPPED_ENERGY, {filter: drop => drop.amount > 100});
                break;
            case 'collect': // Collect from containers
                targets = _.filter(this.room.containers, container => container.store[RESOURCE_ENERGY] > 1000);
                break;
            case 'supplyTowers': // Find towers in need of energy
                targets = _.filter(this.room.towers, tower => tower.energy < tower.energyCapacity);
                break;
            case 'supply': // Find structures in need of energy
                targets = _.filter(this.room.sinks, structure => structure.energy < structure.energyCapacity);
                break;
            case 'repair': // Repair structures
                targets = _.filter(this.room.repairables,
                                   s => s.hits < s.hitsMax &&
                                        (s.structureType != STRUCTURE_CONTAINER || s.hits < 0.7 * s.hitsMax) &&
                                        (s.structureType != STRUCTURE_ROAD || s.hits < 0.7 * s.hitsMax));
                break;
            case 'build': // Build construction jobs
                targets = this.room.structureSites;
                break;
            case 'buildRoads': // Build construction jobs
                targets = this.room.roadSites;
                break;
            case 'fortify': // Fortify walls
                var fortifyLevel = this.settings.fortifyLevel; // global fortify level
                if (this.override.fortifyLevel[this.room.name]) {
                    fortifyLevel = this.override.fortifyLevel[this.room.name]; // override for certain rooms
                }
                //noinspection JSReferencingMutableVariableFromClosure
                targets = _.filter(this.room.barriers, s => s.hits < fortifyLevel);
                break;
            case 'upgrade': // Upgrade controller
                if (this.room.controller && this.room.controller.my) {
                    targets = [this.room.controller];
                }
                break;
        }
        return targets;
    }

    getMostUrgentTask(tasksToGet) {
        for (let taskType of tasksToGet) {
            var targets = this.getTasks(taskType);
            // if (targets.length > 0) {
            var taskToExecute = tasks(this.taskToExecute[taskType]); // create task object
            // remove targets that are already targeted by too many creeps
            //noinspection JSReferencingMutableVariableFromClosure
            // for (let t of targets) {
            //     console.log(t.targetedBy);
            //     console.log(t, t.targetedBy.length, taskToExecute.maxPerTarget);
            // }
            // TODO: cache this
            targets = _.filter(targets, target => target != null &&
                                                  target.targetedBy.length < taskToExecute.maxPerTarget);
            if (targets.length > 0) { // return on the first instance of a target being found
                return [taskToExecute, targets];
            }
            //}
        }
        return [null, null];
    }

    assignTask(creep) { // TODO: fix duplicate task assignments
        var applicableTasks = _.filter(this.taskPriorities,
                                       task => this.assignmentRoles[task].includes(creep.memory.role) &&
                                               this.assignmentConditions[task](creep));
        var [task, targets] = this.getMostUrgentTask(applicableTasks);
        // Assign the task
        if (targets != null) {
            var target = creep.pos.findClosestByRange(targets, {filter: t => t != null}); // bug: some tasks aren't assigned for findClosestByPath
            // console.log(creep, task, target, targets )
            if (target) {
                return creep.assign(task, target);
            }
        }
        return null;
    }


    // Creep quantity and size requirements ============================================================================

    calculateWorkerRequirementsByEnergy() {
        // Calculate needed numbers of workers from an energetics standpoint
        var spawn = this.spawn;
        if (spawn) {
            if (this.override.workersPerRoom[this.name]) {
                return this.override.workersPerRoom[this.name]
            }
            var energy = this.room.energyCapacityAvailable;
            var workerBodyPattern = roles('worker').settings.bodyPattern;
            var workerSize = Math.min(Math.floor(energy / spawn.cost(workerBodyPattern)),
                                      this.settings.workerPatternRepetitionLimit);
            var equilibriumEnergyPerTick = workerSize;
            if (this.room.storage == undefined) {
                equilibriumEnergyPerTick /= 3; // workers spend a lot of time walking around if there's not storage
            }
            var sourceEnergyPerTick = (3000 / 300) * this.room.sources.length;
            return Math.ceil(0.8 * sourceEnergyPerTick / equilibriumEnergyPerTick); // operate under capacity limit
        } else {
            return null;
        }
    }

    calculateWorkerRequirementsByJobs() { // TODO: replace from number of jobs to total time of jobs
        // Calculate needed number of workers based on number of jobs present; used at >=RCL5
        // repair jobs - custom calculated; workers should spawn once several repairs are needed to roads
        // var numRepairJobs = this.room.find(FIND_STRUCTURES, {
        //     filter: (s) => s.hits < s.hitsMax &&
        //                    s.structureType != STRUCTURE_CONTAINER && // containers are repaired by miners
        //                    s.structureType != STRUCTURE_WALL && // walls are fortify tasks
        //                    s.structureType != STRUCTURE_RAMPART &&
        //                    (s.structureType != STRUCTURE_ROAD || s.hits < 0.5 * s.hitsMax) // lower threshold to spawn
        // }).length;
        var numRepairJobs = _.filter(this.room.repairables,
                                     s =>s.hits < s.hitsMax &&
                                         (s.structureType != STRUCTURE_ROAD || s.hits < 0.5 * s.hitsMax)).length;
        // construction jobs
        var numConstructionJobs = this.getTasks('build').length + this.getTasks('buildRoads').length;
        // fortify jobs
        var numFortifyJobs = this.getTasks('fortify').length;
        var numJobs = numRepairJobs + numConstructionJobs + numFortifyJobs;
        if (numJobs == 0) {
            return 0;
        } else {
            var workerBodyPattern = roles('worker').settings.bodyPattern;
            var workerSize = Math.min(Math.floor(this.room.energyCapacityAvailable / this.spawn.cost(workerBodyPattern)),
                                      this.settings.workerPatternRepetitionLimit);
            return Math.min(Math.ceil((2 / workerSize) * numJobs), this.settings.maxWorkersPerRoom);
        }
    }

    calculateHaulerSize(target, remote = false) { // required hauler size to fully saturate a source given distance
        var haulerBodyPattern = roles('hauler').settings.bodyPattern;
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
        if (spawn && this.room && this.room.storage) {
            if (target.linked && this.room.storage.linked) { // don't send haulers to linked sources
                return [null, null];
            }
            var haulerBodyPattern = roles('hauler').settings.bodyPattern;
            var haulerSize = this.calculateHaulerSize(target, remote); // calculate required hauler size
            var numHaulers = 1; // 1 hauler unless it's too large
            var maxHaulerSize = Math.min(Math.floor(this.room.energyCapacityAvailable / spawn.cost(haulerBodyPattern)),
                                         (50 / haulerBodyPattern.length));
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


    // Domestic creep spawning operations ==============================================================================

    handleMiners() {
        if (this.incubating) {
            return null; // don't make your own miners during incubation
        }
        var sources = this.room.sources; // don't use ACTIVE_SOURCES; need to always be handled
        for (let source of sources) {
            // TODO: calculation of number of miners to assign to each source based on max size of creep
            // Check enough miners are supplied
            let assignedMiners = source.getAssignedCreepAmounts('miner');
            if (assignedMiners < this.settings.minersPerSource) {
                return roles('miner').create(this.spawn, {
                    assignment: source,
                    workRoom: this.room.name
                });
            }
        }
        return null;
    }

    handleHaulers() {
        // Check enough haulers are supplied
        if (this.room.storage != undefined) { // haulers are only built once a room has storage
            // find all unlinked sources
            // var sources = this.room.find(FIND_SOURCES, {
            //     filter: source => source.linked == false || this.room.storage.linked == false
            // });
            var sources = _.filter(this.room.sources, s => s.linked == false || this.room.storage.linked == false);
            for (let source of sources) {
                // Check enough haulers are supplied if applicable
                let assignedHaulers = source.getAssignedCreepAmounts('hauler');
                var [haulerSize, numHaulers] = this.calculateHaulerRequirements(source);
                if (assignedHaulers < numHaulers) {
                    return roles('hauler').create(this.spawn, {
                        assignment: source,
                        workRoom: this.room.name,
                        patternRepetitionLimit: haulerSize
                    });
                }
            }
        }
        return null;
    }

    handleLinkers() {
        // Check enough haulers are supplied
        if (this.room.storage != undefined && this.room.storage.linked) { // linkers only for storage with links
            if (this.room.storage.getAssignedCreepAmounts('linker') < 1) {
                return roles('linker').create(this.spawn, {
                    assignment: this.room.storage,
                    workRoom: this.room.name,
                    patternRepetitionLimit: 1
                });
            }
        }
        return null;
    }

    handleMineralSuppliers() {
        // Check enough haulers are supplied
        if (this.room.terminal != undefined && this.room.labs.length > 0) {
            if (this.room.terminal.getAssignedCreepAmounts('mineralSupplier') < 1) {
                return roles('mineralSupplier').create(this.spawn, {
                    assignment: this.room.terminal,
                    workRoom: this.room.name,
                    patternRepetitionLimit: 1
                });
            }
        }
        return null;
    }

    handleSuppliers() {
        // Handle suppliers
        var numSuppliers = this.room.controller.getAssignedCreepAmounts('supplier');
        // var energySinks = this.room.find(FIND_STRUCTURES, {
        //     filter: (structure) => (structure.structureType == STRUCTURE_TOWER ||
        //                             structure.structureType == STRUCTURE_EXTENSION ||
        //                             structure.structureType == STRUCTURE_SPAWN)
        // });
        var numEnergySinks = this.room.sinks.length + this.room.towers.length;
        var storageUnits = this.room.storageUnits;
        if (numEnergySinks <= 1) { // if there's just a spawner in the room, like in RCL1 rooms
            return null;
        }
        var supplierLimit = 2; // there must always be at least one supplier in the room
        // if (_.filter(energySinks, s => s.energy < s.energyCapacity).length > 0) {
        //     supplierLimit += 1;
        // }
        var expensiveFlags = _.filter(this.room.assignedFlags, flag => flagCodes.millitary.filter(flag) ||
                                                                       flagCodes.destroy.filter(flag) ||
                                                                       flagCodes.industry.filter(flag) ||
                                                                       flagCodes.territory.filter(flag));
        supplierLimit += Math.floor(expensiveFlags.length / 10); // add more suppliers for cases of lots of flags // TODO: better metric
        if (numSuppliers < supplierLimit) {
            return roles('supplier').create(this.spawn, {
                assignment: this.room.controller,
                workRoom: this.room.name,
                patternRepetitionLimit: this.settings.supplierPatternRepetitionLimit
            });
        } else {
            return null;
        }
    }

    handleWorkers() {
        if (this.incubating) {
            return null; // don't make your own workers during incubation period, just keep existing ones alive
        }
        var numWorkers = this.room.controller.getAssignedCreepAmounts('worker');
        // var containers = this.room.find(FIND_STRUCTURES, {
        //     filter: structure => (structure.structureType == STRUCTURE_CONTAINER ||
        //                           structure.structureType == STRUCTURE_STORAGE)
        // });
        // Only spawn workers once containers are up
        var workerRequirements;
        if (this.room.storage) {
            workerRequirements = this.calculateWorkerRequirementsByJobs(); // switch to worker/upgrader once storage
        } else {
            workerRequirements = this.calculateWorkerRequirementsByEnergy(); // no static upgraders prior to RCL4
        }
        if (workerRequirements && numWorkers < workerRequirements && this.room.storageUnits.length > 0) {
            return roles('worker').create(this.spawn, {
                assignment: this.room.controller,
                workRoom: this.room.name,
                patternRepetitionLimit: this.settings.workerPatternRepetitionLimit
            });
        }
        return null;
    }

    handleUpgraders() {
        if (!this.room.storage) { // room needs to have storage before upgraders happen
            return null;
        }
        var numUpgraders = this.room.controller.getAssignedCreepAmounts('upgrader');
        var amountOver = Math.max(this.room.storage.store[RESOURCE_ENERGY]
                                  - this.settings.storageBuffer['upgrader'], 0);
        var upgraderSize = 1 + Math.floor(amountOver / 20000);
        var numUpgradersNeeded = Math.ceil(upgraderSize * roles('upgrader').bodyPatternCost /
                                           this.room.energyCapacityAvailable); // this causes a jump at 2 upgraders
        if (numUpgraders < numUpgradersNeeded) {
            return roles('upgrader').create(this.spawn, {
                assignment: this.room.controller,
                workRoom: this.room.name,
                patternRepetitionLimit: upgraderSize
            });
        }
        return null;
    }

    handleDomesticSpawnOperations() {
        var handleResponse;
        // Domestic operations
        var prioritizedDomesticOperations = [
            () => this.handleSuppliers(), // don't move this from top
            () => this.handleLinkers(),
            () => this.handleMineralSuppliers(),
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

        // Renew expensive creeps if needed
        let creepsNeedingRenewal = this.spawn.pos.findInRange(FIND_MY_CREEPS, 1, {
            filter: creep => creep.memory.data.renewMe && creep.ticksToLive < 500
        });
        if (creepsNeedingRenewal.length > 0) {
            return 'renewing (renew call is done through task_getRenewed.work)';
        }

        return null;
    }


    // Spawner operations ==============================================================================================
    // TODO: Move to Brain_Spawn.js

    handleIncubationSpawnOperations() { // spawn fat workers to send to a new room to get it running fast
        var incubateFlags = _.filter(this.room.assignedFlags,
                                     flag => flagCodes.territory.claimAndIncubate.filter(flag) &&
                                             flag.room && flag.room.controller.my);
        incubateFlags = _.sortBy(incubateFlags, flag => flag.pathLengthToAssignedRoomStorage);
        for (let flag of incubateFlags) {
            // spawn miner creeps
            let minerBehavior = roles('miner');
            for (let source of flag.room.sources) {
                if (source.getAssignedCreepAmounts('miner') < this.settings.minersPerSource) {
                    let creep = roles('miner').create(this.spawn, {
                        assignment: source,
                        workRoom: flag.room.name
                    });
                    creep.memory.data.renewMe = true;
                    return creep;
                }
            }
            // spawn worker creeps
            let workerBehavior = roles('worker');
            let incubationWorkers = _.filter(flag.room.controller.assignedCreeps['worker'],
                                             c => c.body.length >= workerBehavior.settings.bodyPattern.length *
                                                                   this.settings.workerPatternRepetitionLimit);
            if (incubationWorkers.length < this.settings.incubationWorkersToSend) {
                let creep = workerBehavior.create(this.spawn, {
                    assignment: flag.room.controller,
                    workRoom: flag.room.name,
                    patternRepetitionLimit: this.settings.workerPatternRepetitionLimit
                });
                creep.memory.data.renewMe = true;
                return creep;
            }
        }
        return null;
    }

    handleAssignedSpawnOperations() {
        var handleResponse;
        // Flag operations
        let flags = this.room.assignedFlags; // TODO: make this a lookup table
        var prioritizedFlagOperations = [
            _.filter(flags, flagCodes.vision.stationary.filter),
            _.filter(flags, flagCodes.territory.claimAndIncubate.filter),
            _.filter(flags, flagCodes.millitary.guard.filter),
            _.filter(flags, flagCodes.territory.reserve.filter),

            _.filter(flags, flagCodes.rally.healPoint.filter),
            _.filter(flags, flagCodes.millitary.destroyer.filter),
            _.filter(flags, flagCodes.millitary.sieger.filter),

            _.filter(flags, flagCodes.industry.remoteMine.filter),
        ];

        // Handle actions associated with assigned flags
        for (let flagPriority of prioritizedFlagOperations) {
            var flagsSortedByRange = _.sortBy(flagPriority, flag => flag.pathLengthToAssignedRoomStorage);
            for (let flag of flagsSortedByRange) {
                handleResponse = flag.action(this);
                if (handleResponse != null) {
                    return handleResponse;
                }
            }
        }
        return null;
    }

    assistAssignedSpawnOperations() { // help out other rooms with their assigned operations
        // other rooms sorted by increasing distance
        let myRooms = _.sortBy(_.filter(Game.rooms, room => room.my), room => this.spawn.pathLengthTo(room.spawns[0]));
        for (let i in myRooms) {
            let brain = myRooms[i].brain;
            let distance = this.spawn.pathLengthTo(myRooms[i].spawns[0]);
            if (!brain.spawn) {
                brain.spawn = this.spawn;
                let creepToBuild = brain.handleAssignedSpawnOperations();
                if (creepToBuild != null) {
                    let lifetime;
                    if (_.map(creepToBuild.body, part => part.type).includes(CLAIM)) {
                        lifetime = 500;
                    } else {
                        lifetime = 1500;
                    }
                    if (distance < this.settings.maxAssistLifetimePercentage * lifetime) {
                        // build the creep if it's not too far away
                        return creepToBuild;
                    }
                }
            }
        }
        return null;
    }

    handleSpawnOperations() {
        if (this.spawn && !this.spawn.spawning) { // only spawn if you have an available spawner
            // figure out what to spawn next
            var creep;
            var prioritizedSpawnOperations = [
                () => this.handleDomesticSpawnOperations(),
                () => this.handleIncubationSpawnOperations(),
                () => this.handleAssignedSpawnOperations(),
                // () => this.assistAssignedSpawnOperations()
            ];
            // Handle all operations
            for (let spawnThis of prioritizedSpawnOperations) {
                creep = spawnThis();
                if (creep != null) {
                    return this.spawn.createCreep(creep.body, creep.name, creep.memory);
                }
            }
            return null;
        } else {
            return null;
        }
    }


    // Market operations ===============================================================================================

    handleTerminalOperations() {
        if (this.room.terminal != undefined) {
            this.room.terminal.brain.run();
        }
    }


    // Safe mode condition =============================================================================================

    handleSafeMode() { // TODO: make this better, defcon system
        // var criticalBarriers = this.room.find(FIND_STRUCTURES, {
        //     filter: (s) => (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART) &&
        //                    s.hits < 5000
        // });
        let criticalBarriers = _.filter(this.room.barriers, s => s.hits < 5000);
        if (criticalBarriers.length > 0 && this.room.hostiles.length > 0 && !this.incubating) {
            // no safe mode for incubating rooms (?)
            this.room.controller.activateSafeMode();
        }
    }

    // List of things executed each tick; only run for rooms that are owned
    run() {
        this.handleSafeMode();
        this.handleSpawnOperations(); // build creeps as needed
        this.handleTerminalOperations(); // repleneish needed resources
    }
}

const profiler = require('screeps-profiler');
profiler.registerClass(RoomBrain, 'RoomBrain');

module.exports = RoomBrain;