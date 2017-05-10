// Overlord - assigns directives and dispenses directives to creeps within a colony

import profiler = require('./lib/screeps-profiler');
import {roleWorker} from "./roles/role_worker";
import {roleHauler} from "./roles/role_hauler";
import {roleMiner} from "./roles/role_miner";
import {roleLinker} from "./roles/role_linker";
import {roleMineralSupplier} from "./roles/role_mineralSupplier";
import {roleSupplier} from "./roles/role_supplier";
import {roleUpgrader} from "./roles/role_upgrader";
import {Colony} from "./Colony";
import {Directive} from "./directives/Directive";
import {Objective} from "./objectives/Objective";
import {
    buildObjective, buildRoadObjective,
    collectEnergyContainerObjective, pickupEnergyObjective, repairObjective, supplyObjective,
    supplyTowerObjective,
} from "./objectives/objectives";


export class Overlord {
    name: string;
    room: Room;
    colony: Colony;
    incubating: boolean;
    settings: any;
    directives: Directive[];
    objectives: { [objectiveName: string]: Objective[] };
    objectivePriorities: string[];
    spawnPriorities: { [role: string]: number };

    constructor(roomName: string) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.colony = Overmind.Colonies[roomName];
        this.objectives = {} as { [objectiveName: string]: Objective[] };
        // Priority that objectives should be performed in
        this.objectivePriorities = [
            'supplyTower',
            'supply',
            'pickupEnergy',
            'collectEnergyContainer',
            'repair',
            'build',
            'buildRoad',
            // 'fortify',
            // 'upgrade',
        ];
        // Priority creeps should be produced in
        this.spawnPriorities = {
            'supplier': 0,
            'linker': 1,
            'mineralSupplier': 2,
            'miner': 3,
            'hauler': 4,
            'worker': 5,
            'upgrader': 5,
        };
        // Configurable settings
        this.settings = {
            incubationWorkersToSend: 3, // number of big workers to send to incubate a room
            supplierPatternRepetitionLimit: 4, // maximum number of body repetitions for suppliers
            storageBuffer: { // creeps of a given role can't withdraw from (or not deposit to) storage until this level
                linker: 75000, // linker must deposit to storage below this amount
                worker: 50000,
                upgrader: 75000,
                default: 0,
            },
            unloadStorageBuffer: 750000, // start sending energy to other rooms past this amount
            reserveBuffer: 3000, // reserve outpost rooms up to this amount
            maxAssistLifetimePercentage: 0.1 // assist in spawn operations up to (creep.lifetime * this amount) distance
        };
    }

    log(message: string) {
        console.log(this.name + ' Overlord: "' + message + '"');
    }


    // Initialization ==================================================================================================

    init(): void {
        this.objectives = this.getObjectives();
    }


    // Objective management ============================================================================================

    getObjectives(): { [objectiveName: string]: Objective[] } {
        // Generate an object containing all objectives for the colony
        var objectives: Objective[] = [];
        for (let room of this.colony.rooms) {
            // Pick up energy
            let droppedEnergy: Resource[] = room.find(FIND_DROPPED_ENERGY, {
                filter: (drop: Resource) => drop.amount > 100,
            }) as Resource[];
            let pickupEnergyObjectives = _.map(droppedEnergy, target => new pickupEnergyObjective(target));

            // Collect energy from containers
            let collectContainers = _.filter(room.containers, container => container.store[RESOURCE_ENERGY] > 1000);
            let collectEnergyContainerObjectives = _.map(collectContainers,
                                                         target => new collectEnergyContainerObjective(target));

            // Find towers in need of energy
            let supplyTowers = _.filter(room.towers, tower => tower.energy < tower.energyCapacity);
            let supplyTowerObjectives = _.map(supplyTowers, target => new supplyTowerObjective(target));

            // Find structures in need of energy
            let supplyStructures = _.filter(room.sinks, sink => sink.energy < sink.energyCapacity);
            let supplyObjectives = _.map(supplyStructures, target => new supplyObjective(target));

            // Repair structures
            let repairStructures = _.filter(room.repairables,
                                            s => s.hits < s.hitsMax &&
                                                 (s.structureType != STRUCTURE_CONTAINER || s.hits < 0.7 * s.hitsMax) &&
                                                 (s.structureType != STRUCTURE_ROAD || s.hits < 0.7 * s.hitsMax));
            let repairObjectives = _.map(repairStructures, target => new repairObjective(target));

            // Build construction jobs that aren't roads
            let constructables = room.structureSites;
            let buildObjectives = _.map(constructables, target => new buildObjective(target));

            // Build roads
            let roadSites = room.roadSites;
            let buildRoadObjectives = _.map(roadSites, target => new buildRoadObjective(target));

            // Push all objectives to the objectives list
            objectives = objectives.concat(pickupEnergyObjectives,
                                           collectEnergyContainerObjectives,
                                           supplyTowerObjectives,
                                           supplyObjectives,
                                           repairObjectives,
                                           buildObjectives,
                                           buildRoadObjectives)
        }

        // Return objectives grouped by type
        return _.groupBy(objectives, objective => objective.name);
    }

    assignTask(creep: Creep): string {
        for (let objType of this.objectivePriorities) {
            let objectives = this.objectives[objType];
            let possibleAssignments: Objective[] = [];
            for (let objective of objectives) {
                if (objective.assignableTo(creep)) {
                    possibleAssignments.push(objective);
                }
            }
            if (possibleAssignments.length > 0) {
                let bestObjective = closestObjectiveByRangeMaybe(possibleAssignments);
                return creep.assign(bestObjective.getTask());
            }
        }
        return "";
    }


    // Colony requirements =============================================================================================

    ensureRequirements(): void {
        // Ensure each source in the colony has the right number of miners assigned to it
        for (let site of this.colony.miningSites) {
            let miningPowerAssigned = _.sum(_.map(site.miners, creep => creep.getActiveBodyparts(WORK)));
            if (miningPowerAssigned < site.miningPowerNeeded) {
                this.colony.hatchery.enqueue(
                    new roleMiner().create(this.spawn, {
                        assignment: site.source,
                        workRoom: this.room.name,
                        patternRepetitionLimit: 3,
                    }), this.spawnPriorities['miner']);
            }
        }

        // Ensure enough haulers exist to satisfy all demand from all colony rooms
        let haulingPowerSupplied = _.sum(_.map(
            _.filter(this.colony.creeps, creep => creep.memory.role == 'hauler'),
            creep => creep.getActiveBodyparts(CARRY)));
        if (haulingPowerSupplied < this.colony.haulingPowerNeeded) {
            this.colony.hatchery.enqueue(
                new roleHauler().create(this.spawn, {
                    assignment: this.room.storage, // remote haulers are assigned to storage
                    workRoom: this.room.name,
                    patternRepetitionLimit: Infinity,
                }), this.spawnPriorities['hauler']);
        }

        // Ensure the room storage has a linker
        if (this.room.storage && this.room.storage.linked) { // linkers only for storage with links
            if (this.room.storage.getAssignedCreepAmounts('linker') < 1) {
                this.colony.hatchery.enqueue(
                    new roleLinker().create(this.spawn, {
                        assignment: this.room.storage,
                        workRoom: this.room.name,
                        patternRepetitionLimit: 8,
                    }), this.spawnPriorities['linker']);
            }
        }

        // Ensure there's a mineral supplier for the labs
        if (this.room.terminal && this.room.labs.length > 0) {
            if (this.room.terminal.getAssignedCreepAmounts('mineralSupplier') < 1) {
                this.colony.hatchery.enqueue(
                    new roleMineralSupplier().create(this.spawn, {
                        assignment: this.room.terminal,
                        workRoom: this.room.name,
                        patternRepetitionLimit: 1,
                    }), this.spawnPriorities['mineralSupplier']);
            }
        }

        // Ensure the room has enough suppliers if there's stuff to supply and miners to harvest energy
        if (this.room.sinks.length > 0 &&
            _.filter(this.colony.creeps, creep => creep.memory.role == 'miner').length > 0) {
            let numSuppliers = this.room.controller!.getAssignedCreepAmounts('supplier');
            let numSuppliersNeeded = 2;
            let supplierSize = this.settings.supplierPatternRepetitionLimit;
            if (numSuppliers == 0) { // If the room runs out of suppliers at low energy, spawn a small supplier
                let supplierSize = 1;
            }
            if (numSuppliers < numSuppliersNeeded) {
                let protocreep = new roleSupplier().create(this.spawn, {
                    assignment: this.room.controller!,
                    workRoom: this.room.name,
                    patternRepetitionLimit: supplierSize // this.settings.supplierPatternRepetitionLimit
                });
                this.colony.hatchery.enqueue(protocreep, this.spawnPriorities['supplier']);
            }
        }

        // Ensure there's enough workers
        if (!this.incubating) { // don't make your own workers during incubation period, just keep existing ones alive
            let numWorkers = this.room.controller!.getAssignedCreepAmounts('worker');
            // Only spawn workers once containers are up
            let numWorkersNeeded = 1; // TODO: maybe a better metric than this
            if (numWorkers < numWorkersNeeded && this.room.storageUnits.length > 0) {
                let protocreep = new roleWorker().create(this.spawn, {
                    assignment: this.room.controller!,
                    workRoom: this.room.name,
                    patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
                });
                this.colony.hatchery.enqueue(protocreep, this.spawnPriorities['worker']);
            }
        }

        // Ensure there are upgraders and scale the size according to how much energy you have
        if (this.room.storage) { // room needs to have storage before upgraders happen
            var numUpgraders = this.room.controller!.getAssignedCreepAmounts('upgrader');
            var amountOver = Math.max(this.room.storage.store[RESOURCE_ENERGY]
                                      - this.settings.storageBuffer['upgrader'], 0);
            var upgraderSize = 1 + Math.floor(amountOver / 20000);
            if (this.room.controller!.level == 8) {
                upgraderSize = Math.min(upgraderSize, 3); // don't go above 15 work parts at RCL 8
            }
            let upgraderRole = new roleUpgrader();
            var numUpgradersNeeded = Math.ceil(upgraderSize * upgraderRole.bodyPatternCost /
                                               this.room.energyCapacityAvailable); // this causes a jump at 2 upgraders
            if (numUpgraders < numUpgradersNeeded) {
                let protocreep = upgraderRole.create(this.spawn, {
                    assignment: this.room.controller!,
                    workRoom: this.room.name,
                    patternRepetitionLimit: upgraderSize,
                });
                this.colony.hatchery.enqueue(protocreep, this.spawnPriorities['upgrader']);
            }
        }
    }



    // Spawner operations ==============================================================================================
    // TODO: Move to Brain_Spawn.js

    handleCoreSpawnOperations() { // core operations needed to keep a room running; all creeps target things in room
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
            filter: (creep: Creep) => creep.memory.data.renewMe && creep.ticksToLive < 500,
        });
        if (creepsNeedingRenewal.length > 0) {
            return 'renewing (renew call is done through task_getRenewed.work)';
        }

        return null;
    }

    handleIncubationSpawnOperations() { // operations to start up a new room quickly by sending renewable large creeps
        var incubateFlags = _.filter(this.room.assignedFlags,
                                     flag => flagCodes.territory.claimAndIncubate.filter(flag) &&
                                             flag.room && flag.room.my);
        incubateFlags = _.sortBy(incubateFlags, flag => flag.pathLengthToAssignedRoomStorage);
        for (let flag of incubateFlags) {
            // spawn miner creeps
            let flagRoom = flag.room!;
            let minerBehavior = new roleMiner();
            for (let source of flagRoom.sources) {
                if (source.getAssignedCreepAmounts('miner') < this.settings.minersPerSource) {
                    let creep = minerBehavior.create(this.spawn, {
                        assignment: source,
                        workRoom: flagRoom.name,
                        patternRepetitionLimit: 3,
                    });
                    creep.memory.data.renewMe = true;
                    return creep;
                }
            }
            // spawn worker creeps
            let workerBehavior = new roleWorker();
            let assignedWorkers = flagRoom.controller!.getAssignedCreeps('worker');
            let incubationWorkers = _.filter(assignedWorkers,
                                             c => c.body.length >= workerBehavior.settings.bodyPattern.length *
                                                                   this.settings.workerPatternRepetitionLimit);
            if (incubationWorkers.length < this.settings.incubationWorkersToSend) {
                let creep = workerBehavior.create(this.spawn, {
                    assignment: flagRoom.controller!,
                    workRoom: flagRoom.name,
                    patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
                });
                creep.memory.data.renewMe = true;
                return creep;
            }
        }
        return null;
    }

    handleAssignedSpawnOperations() { // operations associated with an assigned flags, such as spawning millitary creeps
        var handleResponse;
        // Flag operations
        let flags = this.room.assignedFlags; // TODO: make this a lookup table
        var prioritizedFlagOperations = [
            _.filter(flags, flagCodes.vision.stationary.filter),
            _.filter(flags, flagCodes.territory.claimAndIncubate.filter),
            _.filter(flags, flagCodes.millitary.guard.filter),
            _.filter(flags, flagCodes.territory.colony.filter),

            // _.filter(flags, flagCodes.rally.healPoint.filter),
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


    handleInferredSpawnOperations() { // spawn operations handled locally but inferred by assigned operations
        var handleResponse;
        var prioritizedOperations = [
            () => this.handleRemoteHaulers(),
        ];

        for (let handler of prioritizedOperations) {
            handleResponse = handler();
            if (handleResponse != null) {
                return handleResponse;
            }
        }

        return null;
    }

    handleSpawnOperations() {
        if (this.spawn && !this.spawn.spawning) { // only spawn if you have an available spawner
            // figure out what to spawn next
            var creep;
            var prioritizedSpawnOperations = [
                () => this.handleCoreSpawnOperations(),
                () => this.handleIncubationSpawnOperations(),
                () => this.handleAssignedSpawnOperations(),
                () => this.handleInferredSpawnOperations(),
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
        if (this.room.terminal) {
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
            this.room.controller!.activateSafeMode();
        }
    }

    // List of things executed each tick; only run for rooms that are owned
    run() {
        // this.handleSafeMode();
        this.handleSpawnOperations(); // build creeps as needed
        this.handleTerminalOperations(); // repleneish needed resources
    }
}

// const profiler = require('screeps-profiler');
profiler.registerClass(Overlord, 'Overlord');
