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
    buildObjective,
    buildRoadObjective,
    collectEnergyContainerObjective,
    pickupEnergyObjective,
    repairObjective,
    supplyObjective,
    supplyTowerObjective,
} from "./objectives/objectives";
import {roleReserver} from "./roles/role_reserver";


export class Overlord implements IOverlord {
    name: string;
    room: Room;
    colony: Colony;
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
            'scout': 1,
            'linker': 1,
            'guard': 2,
            'mineralSupplier': 3,
            'miner': 4,
            'hauler': 5,
            'worker': 6,
            'reserver': 6,
            'upgrader': 7,
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

    log(message: string): void {
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

    countObjectives(name: string): number {
        // Count objectives of a certain type
        if (this.objectives[name]) {
            return this.objectives[name].length;
        } else {
            return 0;
        }
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


    // Spawner operations ==============================================================================================

    handleCoreSpawnOperations(): void {
        // Handle all creep spawning requirements for homeostatic processes.
        // Injects protocreeps into a priority queue in Hatchery. Other spawn operations are done with directives.

        function handleMiners(): void {
            // Ensure each source in the colony has the right number of miners assigned to it
            for (let site of this.colony.miningSites) {
                let miningPowerAssigned = _.sum(_.map(site.miners, (creep: Creep) => creep.getActiveBodyparts(WORK)));
                if (miningPowerAssigned < site.miningPowerNeeded) {
                    this.colony.hatchery.enqueue(
                        new roleMiner().create(this.colony, {
                            assignment: site.source,
                            patternRepetitionLimit: 3,
                        }), this.spawnPriorities['miner']);
                }
            }
        }

        function handleHaulers(): void {
            // Ensure enough haulers exist to satisfy all demand from all colony rooms
            let haulingPowerSupplied = _.sum(_.map(
                _.filter(this.colony.creeps, (creep: Creep) => creep.memory.role == 'hauler'),
                creep => creep.getActiveBodyparts(CARRY)));
            if (haulingPowerSupplied < this.colony.haulingPowerNeeded) {
                this.colony.hatchery.enqueue(
                    new roleHauler().create(this.colony, {
                        assignment: this.room.storage, // remote haulers are assigned to storage
                        patternRepetitionLimit: Infinity,
                    }), this.spawnPriorities['hauler']);
            }
        }

        function handleSuppliers(): void {
            // Ensure the room has enough suppliers if there's stuff to supply and miners to harvest energy
            if (this.room.sinks.length > 0 &&
                _.filter(this.colony.creeps, (creep: Creep) => creep.memory.role == 'miner').length > 0) {
                let numSuppliers = this.room.controller!.getAssignedCreepAmounts('supplier');
                let numSuppliersNeeded = 2;
                let supplierSize = this.settings.supplierPatternRepetitionLimit;
                if (numSuppliers == 0) { // If the room runs out of suppliers at low energy, spawn a small supplier
                    let supplierSize = 1;
                }
                if (numSuppliers < numSuppliersNeeded) {
                    let protocreep = new roleSupplier().create(this.colony, {
                        assignment: this.room.controller!,
                        patternRepetitionLimit: supplierSize // this.settings.supplierPatternRepetitionLimit
                    });
                    this.colony.hatchery.enqueue(protocreep, this.spawnPriorities['supplier']);
                }
            }
        }

        function handleLinkers(): void {
            // Ensure the room storage has a linker
            if (this.room.storage && this.room.storage.linked) { // linkers only for storage with links
                if (this.room.storage.getAssignedCreepAmounts('linker') < 1) {
                    this.colony.hatchery.enqueue(
                        new roleLinker().create(this.colony, {
                            assignment: this.room.storage,
                            patternRepetitionLimit: 8,
                        }), this.spawnPriorities['linker']);
                }
            }
        }

        function handleMineralSuppliers(): void {
            // Ensure there's a mineral supplier for the labs
            if (this.room.terminal && this.room.labs.length > 0) {
                if (this.room.terminal.getAssignedCreepAmounts('mineralSupplier') < 1) {
                    this.colony.hatchery.enqueue(
                        new roleMineralSupplier().create(this.colony, {
                            assignment: this.room.terminal,
                            patternRepetitionLimit: 1,
                        }), this.spawnPriorities['mineralSupplier']);
                }
            }
        }

        function handleReservers(): void {
            // Ensure each controller in colony outposts has a reserver if needed
            let outpostControllers = _.compact(_.map(this.colony.outposts, (room: Room) => room.controller));
            for (let controller of outpostControllers) {
                if (!controller.reservation ||
                    (controller.reservedByMe && controller.reservation.ticksToEnd < this.settings.reserveBuffer)) {
                    let reservationFlag = controller.room.colonyFlag;
                    this.colony.hatchery.enqueue(
                        new roleReserver().create(this.colony, {
                            assignment: reservationFlag,
                            patternRepetitionLimit: 4,
                        }), this.spawnPriorities['reserver']);
                }
            }
        }

        function handleWorkers(): void {
            // Ensure there's enough workers
            if (!this.incubating) { // don't make your own workers during incubation period, just keep existing ones alive
                let numWorkers = this.room.controller!.getAssignedCreepAmounts('worker');
                // Only spawn workers once containers are up
                let numWorkersNeeded = 1; // TODO: maybe a better metric than this
                if (numWorkers < numWorkersNeeded && this.room.storageUnits.length > 0) {
                    this.colony.hatchery.enqueue(
                        new roleWorker().create(this.colony, {
                            assignment: this.room.controller!,
                            patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
                        }), this.spawnPriorities['worker']);
                }
            }
        }

        function handleUpgraders(): void {
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
                    this.colony.hatchery.enqueue(
                        upgraderRole.create(this.colony, {
                            assignment: this.room.controller!,
                            patternRepetitionLimit: upgraderSize,
                        }), this.spawnPriorities['upgrader']);
                }
            }
        }

        // Handle all requirements; since requirements create priority queue, calling order doesn't actually matter
        handleSuppliers();
        handleLinkers();
        handleMineralSuppliers();
        handleMiners();
        handleHaulers();
        handleReservers();
        handleWorkers();
        handleUpgraders();

        // TODO: handle creep renewal
        // // Renew expensive creeps if needed
        // let creepsNeedingRenewal = this.spawn.pos.findInRange(FIND_MY_CREEPS, 1, {
        //     filter: (creep: Creep) => creep.memory.data.renewMe && creep.ticksToLive < 500,
        // });
        // if (creepsNeedingRenewal.length > 0) {
        //     return 'renewing (renew call is done through task_getRenewed.work)';
        // }
    }


    handleIncubationSpawnOperations(): void { // operations to start up a new room quickly by sending large creeps
        var incubateFlags = _.filter(this.room.assignedFlags,
                                     flag => flagCodes.territory.claimAndIncubate.filter(flag) &&
                                             flag.room && flag.room.my);
        incubateFlags = _.sortBy(incubateFlags, flag => flag.pathLengthToAssignedRoomStorage);
        for (let flag of incubateFlags) {
            // spawn miner creeps
            let minerBehavior = new roleMiner();
            for (let source of flag.room.sources) {
                if (source.getAssignedCreepAmounts('miner') < this.settings.minersPerSource) {
                    let protoCreep = minerBehavior.create(this.colony, {
                        assignment: source,
                        patternRepetitionLimit: 3,
                    });
                    protoCreep.memory.colony = flag.room.name;
                    protoCreep.memory.data.renewMe = true;
                    this.colony.hatchery.enqueue(protoCreep);
                }
            }
            // spawn worker creeps
            let workerBehavior = new roleWorker();
            let assignedWorkers = flag.room.controller!.getAssignedCreeps('worker');
            let incubationWorkers = _.filter(assignedWorkers,
                                             c => c.body.length >= workerBehavior.settings.bodyPattern.length *
                                                                   this.settings.workerPatternRepetitionLimit);
            if (incubationWorkers.length < this.settings.incubationWorkersToSend) {
                let protoCreep = workerBehavior.create(this.colony, {
                    assignment: flag.room.controller!,
                    patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
                });
                protoCreep.memory.colony = flag.room.name;
                protoCreep.memory.data.renewMe = true;
                this.colony.hatchery.enqueue(protoCreep);
            }
        }
    }

    handleAssignedSpawnOperations(): void { // operations associated with an assigned flags
        // Flag operations
        let flags = this.room.assignedFlags; // TODO: make this a lookup table
        var prioritizedFlagOperations = [
            _.filter(flags, flagCodes.vision.stationary.filter),
            _.filter(flags, flagCodes.territory.claimAndIncubate.filter),
            _.filter(flags, flagCodes.millitary.guard.filter),
            // _.filter(flags, flagCodes.territory.colony.filter),

            _.filter(flags, flagCodes.millitary.destroyer.filter),
            _.filter(flags, flagCodes.millitary.sieger.filter),

            // _.filter(flags, flagCodes.industry.remoteMine.filter),
        ];

        // Handle actions associated with assigned flags
        for (let flagPriority of prioritizedFlagOperations) {
            let flagsSortedByRange = _.sortBy(flagPriority, flag => flag.pathLengthToAssignedRoomStorage);
            for (let flag of flagsSortedByRange) {
                flag.action();
            }
        }
    }

    handleSpawnOperations(): void {
        if (this.colony.hatchery.availableSpawns.length > 0) { // only spawn if you have an available spawner
            this.handleCoreSpawnOperations();
            this.handleIncubationSpawnOperations();
            this.handleAssignedSpawnOperations();
        }
    }


    // Market operations ===============================================================================================

    handleTerminalOperations(): void {
        if (this.room.terminal) {
            this.room.terminal.brain.run();
        }
    }


    // Safe mode condition =============================================================================================

    handleSafeMode(): void {
        // Simple safe mode handler; will eventually be replaced by something more sophisticated
        // Calls for safe mode when walls are about to be breached and there are non-NPC hostiles in the room
        let criticalBarriers = _.filter(this.room.barriers, s => s.hits < 5000);
        let nonInvaderHostiles = _.filter(this.room.hostiles, creep => creep.owner.username != "Invader");
        if (criticalBarriers.length > 0 && nonInvaderHostiles.length > 0 && !this.colony.incubating) {
            this.room.controller!.activateSafeMode();
        }
    }

    // List of things executed each tick; only run for rooms that are owned
    run(): void {
        this.init();
        this.handleSafeMode();
        this.handleSpawnOperations(); // build creeps as needed
        this.handleTerminalOperations(); // replenish needed resources
    }
}

profiler.registerClass(Overlord, 'Overlord');
