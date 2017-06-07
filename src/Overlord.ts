/* The Overlord object handles most of the task assignment and directs the spawning operations for each Colony. */

import profiler = require('./lib/screeps-profiler');

import {Colony} from './Colony';
import {
	ObjectiveBuild,
	ObjectiveBuildRoad,
	ObjectiveCollectEnergyMiningSite,
	ObjectiveFortify,
	ObjectivePickupEnergy,
	ObjectiveRepair,
	ObjectiveUpgrade
} from './objectives/objectives';
import {MinerSetup} from './roles/miner';
import {HaulerSetup} from './roles/hauler';
import {MineralSupplierSetup} from './roles/mineralSupplier';
import {SupplierSetup} from './roles/supplier';
import {ReserverSetup} from './roles/reserver';
import {WorkerSetup} from './roles/worker';
import {UpgraderSetup} from './roles/upgrader';
import {ObjectiveGroup} from './objectives/ObjectiveGroup';
import {ResourceRequestGroup} from './resourceRequests/ResourceRequestGroup';
import {ManagerSetup} from './roles/manager';


export class Overlord implements IOverlord {
	name: string; 								// Name of the primary colony room
	memory: any; 								// Memory.colony.overlord
	room: Room; 								// Colony room
	colony: Colony; 							// Instantiated colony object
	settings: any; 								// Adjustable settings
	// directives: Directive[]; 					// Directives for response to stimuli
	private objectivePriorities: string[]; 		// Prioritization for objectives in the objectiveGroup
	objectiveGroup: ObjectiveGroup; 			// Box for objectives assignable from this object
	resourceRequests: ResourceRequestGroup;		// Box for resource requests

	constructor(colony: Colony) {
		this.name = colony.name;
		this.room = colony.room;
		this.colony = colony;
		this.memory = colony.memory.overlord;
		// Priority that objectives should be performed in
		this.objectivePriorities = [
			'supplyTower',
			'supply',
			'pickupEnergy',
			'collectEnergyMiningSite',
			'collectEnergyContainer',
			'build',
			'repair',
			'buildRoad',
			'fortify',
			'upgrade',
		];
		this.objectiveGroup = new ObjectiveGroup(this.objectivePriorities);
		this.resourceRequests = new ResourceRequestGroup();
		// Configurable settings
		this.settings = {
			incubationWorkersToSend       : 3,  // number of big workers to send to incubate a room
			supplierPatternRepetitionLimit: _.min([2 * this.room.controller!.level, 8]),  // supplier body repetitions
			storageBuffer                 : {   // creeps of a given role can't withdraw until this level
				manager : 75000,
				worker  : 50000,
				upgrader: 75000,
			},
			unloadStorageBuffer           : 750000, // start sending energy to other rooms past this amount
			reserveBuffer                 : 3000, 	// reserve outpost rooms up to this amount
			maxAssistLifetimePercentage   : 0.1 	// assist in spawn operations up to (creep.lifetime * this amount) distance
		};
	}

	log(...args: any[]): void {
		console.log(this.name, ' Overlord: "', ...args, '".');
	}


	// Objective management ============================================================================================

	/* Register objectives from across the colony in the objectiveGroup. Some objectives are registered by other
	 * colony objects, like Hatchery and CommandCenter objectives. */
	private registerObjectives(): void {
		// Collect energy from component sites that have requested a hauler withdrawal
		let withdrawalRequests = _.filter(this.resourceRequests.resourceOut.haul,
										  request => request.resourceType == RESOURCE_ENERGY);
		let collectSites = _.map(withdrawalRequests, request => request.target);
		let collectEnergyMiningSiteObjectives = _.map(collectSites, site =>
			new ObjectiveCollectEnergyMiningSite(site as Container));

		this.objectiveGroup.registerObjectives(collectEnergyMiningSiteObjectives);

		// Register tasks across all rooms in colony
		for (let room of this.colony.rooms) {
			// Pick up energy
			let droppedEnergy: Resource[] = _.filter(room.droppedEnergy, d => d.amount > 100);
			let pickupEnergyObjectives = _.map(droppedEnergy, target => new ObjectivePickupEnergy(target));

			// Repair structures
			let repairStructures = _.filter(room.repairables,
											s => s.hits < s.hitsMax &&
												 (s.structureType != STRUCTURE_CONTAINER || s.hits < 0.7 * s.hitsMax) &&
												 (s.structureType != STRUCTURE_ROAD || s.hits < 0.7 * s.hitsMax));
			let repairObjectives = _.map(repairStructures, target => new ObjectiveRepair(target));

			// Build construction jobs that aren't roads
			let buildObjectives = _.map(room.structureSites, site => new ObjectiveBuild(site));

			// Build roads
			let buildRoadObjectives = _.map(room.roadSites, site => new ObjectiveBuildRoad(site));

			// Fortify barriers
			let lowestBarriers = _.sortBy(room.barriers, barrier => barrier.hits).slice(0, 5);
			let fortifyObjectives = _.map(lowestBarriers, barrier => new ObjectiveFortify(barrier));

			// Upgrade controller
			let upgradeObjectives: IObjective[] = [];
			if (room.controller) {
				upgradeObjectives = [new ObjectiveUpgrade(room.controller)];
			}

			// Register the objectives in the objectiveGroup
			this.objectiveGroup.registerObjectives(pickupEnergyObjectives,
												   repairObjectives,
												   buildObjectives,
												   buildRoadObjectives,
												   fortifyObjectives,
												   upgradeObjectives);
		}
	}

	/* Assign a task to a creep. Uses the default ObjectiveGroup assignment logic. */
	assignTask(creep: ICreep): void {
		this.objectiveGroup.assignTask(creep);
	}


	// Spawner operations ==============================================================================================

	/* Handle all creep spawning requirements for homeostatic processes.
	 * Injects protocreeps into a priority queue in Hatchery. Other spawn operations are done with directives.*/
	private handleCoreSpawnOperations(): void {
		// Ensure each source in the colony has the right number of miners assigned to it
		for (let siteID in this.colony.miningSites) {
			let site = this.colony.miningSites[siteID];
			let miningPowerAssigned = _.sum(_.map(site.miners, (creep: Creep) => creep.getActiveBodyparts(WORK)));
			if (miningPowerAssigned < site.miningPowerNeeded) {
				this.colony.hatchery.enqueue(
					new MinerSetup().create(this.colony, {
						assignment            : site.source,
						patternRepetitionLimit: 3,
					}));
			}
		}

		// Ensure enough haulers exist to satisfy all demand from all colony rooms
		if (this.colony.data.haulingPowerSupplied < this.colony.data.haulingPowerNeeded) {
			this.colony.hatchery.enqueue(
				new HaulerSetup().create(this.colony, {
					assignment            : this.room.storage, // remote haulers are assigned to storage
					patternRepetitionLimit: Infinity,
				}));
		}

		// Ensure the hatchery has suppliers; emergency suppliers handled directly by hatchery
		if (this.room.sinks.length > 0 && this.colony.getCreepsByRole('miner').length > 0) {
			let supplierSize = this.settings.supplierPatternRepetitionLimit;
			// let supplierCost = supplierSize * (new SupplierSetup().bodyPatternCost);
			// if (this.room.energyAvailable < supplierCost) {
			// 	supplierSize = 1; // If the room runs out of suppliers at low energy, spawn a small supplier
			// }
			let numSuppliers = _.filter(this.colony.getCreepsByRole('supplier'), // number of big suppliers in colony
										creep => creep.getActiveBodyparts(MOVE) == supplierSize).length;
			let numSuppliersNeeded = 1;
			if (numSuppliers < numSuppliersNeeded) {
				this.colony.hatchery.enqueue(new SupplierSetup().create(this.colony, {
					assignment            : this.room.controller!,
					patternRepetitionLimit: supplierSize,
				}));
			}
		}

		// Ensure the command center has a manager if applicable
		if (this.room.storage && this.room.storage.linked) { // linkers only for storage with links
			if (this.colony.getCreepsByRole('manager').length < 1 && this.colony.commandCenter) {
				this.colony.hatchery.enqueue(
					new ManagerSetup().create(this.colony, {
						assignment            : this.room.storage,
						patternRepetitionLimit: 8,
					}));
			}
		}

		// Ensure there's a mineral supplier for the labs
		if (this.room.terminal && this.room.labs.length > 0) {
			if (this.colony.getCreepsByRole('mineralSupplier').length < 1) {
				this.colony.hatchery.enqueue(
					new MineralSupplierSetup().create(this.colony, {
						assignment            : this.room.terminal,
						patternRepetitionLimit: 1,
					}));
			}
		}

		// Ensure each controller in colony outposts has a reserver if needed
		let outpostControllers = _.compact(_.map(this.colony.outposts, room => room.controller)) as Controller[];
		for (let controller of outpostControllers) {
			if (!controller.reservation ||
				(controller.reservedByMe && controller.reservation.ticksToEnd < this.settings.reserveBuffer)) {
				let reservationFlag = controller.room.colonyFlag;
				let assignedReservers = reservationFlag.getAssignedCreepAmounts('reserver');
				if (assignedReservers == 0) {
					this.colony.hatchery.enqueue(
						new ReserverSetup().create(this.colony, {
							assignment            : reservationFlag,
							patternRepetitionLimit: 4,
						}));
				}
			}
		}

		// Ensure there's enough workers
		if (!this.colony.incubating) { // don't make your own workers during incubation period, just keep existing ones alive
			let numWorkers = this.colony.getCreepsByRole('worker').length;
			// Only spawn workers once containers are up
			let numWorkersNeeded = 1; // TODO: maybe a better metric than this
			if (numWorkers < numWorkersNeeded && this.room.storageUnits.length > 0) {
				this.colony.hatchery.enqueue(
					new WorkerSetup().create(this.colony, {
						assignment            : this.room.controller!,
						patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
					}));
			}
		}

		// Ensure there are upgraders and scale the size according to how much energy you have
		if (this.room.storage) { // room needs to have storage before upgraders happen
			var numUpgraders = this.colony.getCreepsByRole('upgrader').length;
			var amountOver = Math.max(this.room.storage.energy - this.settings.storageBuffer['upgrader'], 0);
			var upgraderSize = 1 + Math.floor(amountOver / 20000);
			if (this.room.controller!.level == 8) {
				upgraderSize = Math.min(upgraderSize, 3); // don't go above 15 work parts at RCL 8
			}
			let upgraderRole = new UpgraderSetup();
			var numUpgradersNeeded = Math.ceil(upgraderSize * upgraderRole.bodyPatternCost /
											   this.room.energyCapacityAvailable); // this causes a jump at 2 upgraders
			if (numUpgraders < numUpgradersNeeded) {
				this.colony.hatchery.enqueue(
					upgraderRole.create(this.colony, {
						assignment            : this.room.controller!,
						patternRepetitionLimit: upgraderSize,
					}));
			}
		}

		// TODO: handle creep renewal
		// // Renew expensive creeps if needed
		// let creepsNeedingRenewal = this.spawn.pos.findInRange(FIND_MY_CREEPS, 1, {
		//     filter: (creep: Creep) => creep.memory.data.renewMe && creep.ticksToLive < 500,
		// });
		// if (creepsNeedingRenewal.length > 0) {
		//     return 'renewing (renew call is done through task_getRenewed.work)';
		// }
	}


	private handleIncubationSpawnOperations(): void { // operations to start up a new room quickly by sending large creeps
		// var incubateFlags = _.filter(this.room.assignedFlags,
		//                              flag => flagCodes.territory.claimAndIncubate.filter(flag) &&
		//                                      flag.room && flag.room.my);
		// incubateFlags = _.sortBy(incubateFlags, flag => flag.pathLengthToAssignedRoomStorage);
		// for (let flag of incubateFlags) {
		//     // Spawn remote miners
		//     for (let siteID in flag.colony.miningSites) {
		//         let site = flag.colony.miningSites[siteID];
		//         let miningPowerAssigned = _.sum(_.map(site.miners, (creep: Creep) => creep.getActiveBodyparts(WORK)));
		//         if (miningPowerAssigned < site.miningPowerNeeded) {
		//             let protoCreep = new MinerSetup().create(this.colony, {
		//                 assignment: site.source,
		//                 patternRepetitionLimit: 3,
		//             });
		//             protoCreep.memory.colony = flag.room.name;
		//             protoCreep.memory.data.renewMe = true;
		//             this.colony.hatchery.enqueue(protoCreep);
		//         }
		//     }
		//     // Spawn remote workers
		//     let assignedWorkers = flag.room.controller!.getAssignedCreeps('worker');
		//     let incubationWorkers = _.filter(assignedWorkers,
		//                                      c => c.body.length >= new WorkerSetup().settings.bodyPattern.length *
		//                                                            this.settings.workerPatternRepetitionLimit);
		//     if (incubationWorkers.length < this.settings.incubationWorkersToSend) {
		//         let protoCreep = new WorkerSetup().create(this.colony, {
		//             assignment: flag.room.controller!,
		//             patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
		//         });
		//         protoCreep.memory.colony = flag.room.name;
		//         protoCreep.memory.data.renewMe = true;
		//         this.colony.hatchery.enqueue(protoCreep);
		//     }
		// }
		// TODO: rewrite this using the core spawn methods + request calls
	}

	private handleAssignedSpawnOperations(): void { // operations associated with an assigned flags
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

	/* Handle all types of spawn operations */
	private handleSpawnOperations(): void {
		if (this.colony.hatchery.availableSpawns.length > 0) { // only spawn if you have an available spawner
			this.handleCoreSpawnOperations();
			this.handleIncubationSpawnOperations();
			this.handleAssignedSpawnOperations();
		}
	}


	// Market operations ===============================================================================================

	// handleTerminalOperations(): void {
	// 	if (this.room.terminal) {
	// 		this.room.terminal.brain.run();
	// 	}
	// }


	// Safe mode condition =============================================================================================

	private handleSafeMode(): void {
		// Simple safe mode handler; will eventually be replaced by something more sophisticated
		// Calls for safe mode when walls are about to be breached and there are non-NPC hostiles in the room
		let criticalBarriers = _.filter(this.room.barriers, s => s.hits < 5000);
		let nonInvaderHostiles = _.filter(this.room.hostiles, creep => creep.owner.username != 'Invader');
		if (criticalBarriers.length > 0 && nonInvaderHostiles.length > 0 && !this.colony.incubating) {
			this.room.controller!.activateSafeMode();
		}
	}

	// Initialization ==================================================================================================

	init(): void {
		this.registerObjectives();
	}

	// Operation =======================================================================================================

	run(): void { // TODO: make register_, handle_ more consistent with init() and run()
		this.handleSafeMode();
		this.handleSpawnOperations(); // build creeps as needed
		// this.handleTerminalOperations(); // replenish needed resources
	}
}

profiler.registerClass(Overlord, 'Overlord');
