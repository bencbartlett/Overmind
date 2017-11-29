/* The Overlord object handles most of the task assignment and directs the spawning operations for each Colony. */


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
import {MineralSupplierSetup} from './roles/mineralSupplier';
import {WorkerSetup} from './roles/worker';
import {ObjectiveGroup} from './objectives/ObjectiveGroup';
import {ResourceRequestGroup} from './resourceRequests/ResourceRequestGroup';
import {DirectiveGuard} from './directives/directive_guard';
import {profileClass} from './profiling';

export class Overlord implements IOverlord {
	name: string; 								// Name of the primary colony room
	memory: OverlordMemory; 					// Memory.colony.overlord
	room: Room; 								// Colony room
	colony: Colony; 							// Instantiated colony object
	// directives: Directive[]; 					// Directives for response to stimuli
	private objectivePriorities: string[]; 		// Prioritization for objectives in the objectiveGroup
	objectiveGroup: ObjectiveGroup; 			// Box for objectives assignable from this object
	resourceRequests: ResourceRequestGroup;		// Box for resource requests
	directives: IDirective[]; 					// Directives across the colony
	settings: {									// Adjustable settings
		incubationWorkersToSend: number,			// number of big workers to send to incubate a room
		storageBuffer: { [role: string]: number },	// creeps of a given role can't withdraw until this level
		unloadStorageBuffer: number,				// start sending energy to other rooms past this amount
		maxAssistLifetimePercentage: number,		// assist in spawn operations up to (creep.lifetime * this) distance
		workerPatternRepetitionLimit: number,		// maximum worker size
	};

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
		// Instantiate objective and resource request groups
		this.objectiveGroup = new ObjectiveGroup(this.objectivePriorities);
		this.resourceRequests = new ResourceRequestGroup();
		// Configurable settings
		this.settings = {
			incubationWorkersToSend     : 3,
			storageBuffer               : {
				manager : 75000,
				worker  : 50000,
				upgrader: 75000,
			},
			unloadStorageBuffer         : 750000,
			maxAssistLifetimePercentage : 0.1,
			workerPatternRepetitionLimit: Infinity,
		};
		// Placeholder array for directives, filled in by Overmind
		this.directives = [];
	}


	// Objective management ============================================================================================

	/* Register objectives from across the colony in the objectiveGroup. Some objectives are registered by other
	 * colony objects, like Hatchery and CommandCenter objectives. */
	private registerObjectives(): void {
		// Collect energy from component sites that have requested a hauler withdrawal
		let withdrawalRequests = _.filter(this.resourceRequests.resourceOut.haul,
										  request => request.resourceType == RESOURCE_ENERGY);
		let collectContainers = _.map(withdrawalRequests, request => request.target);
		let collectEnergyMiningSiteObjectives = _.map(collectContainers, container =>
			new ObjectiveCollectEnergyMiningSite(container as Container));

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
			let fortifyObjectives: IObjective[] = [];
			if (!this.colony.incubator) {
				let lowestBarriers = _.sortBy(room.barriers, barrier => barrier.hits).slice(0, 5);
				fortifyObjectives = _.map(lowestBarriers, barrier => new ObjectiveFortify(barrier));
			}

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

	/* Handle remaining creep spawning requirements for homeostatic processes which aren't handled by hiveClusters.
	 * Injects protocreeps into a priority queue in Hatchery. Other spawn operations are done with directives. */
	private registerCreepRequests(): void {
		if (this.colony.hatchery) {
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

			// // Ensure each controller in colony outposts has a reserver if needed
			// let outpostControllers = _.compact(_.map(this.colony.outposts, room => room.controller)) as Controller[];
			// for (let controller of outpostControllers) {
			// 	if (!controller.reservation ||
			// 		(controller.reservedByMe && controller.reservation.ticksToEnd < this.settings.reserveBuffer)) {
			// 		let reservationFlag = controller.room.colonyFlag;
			// 		let assignedReservers = reservationFlag.getAssignedCreepAmounts('reserver');
			// 		if (assignedReservers == 0) {
			// 			this.colony.hatchery.enqueue(
			// 				new ReserverSetup().create(this.colony, {
			// 					assignment            : reservationFlag,
			// 					patternRepetitionLimit: 4,
			// 				}));
			// 		}
			// 	}
			// }

			// Ensure there's enough workers
			let numWorkers = this.colony.getCreepsByRole('worker').length;
			let numWorkersNeeded; // TODO: maybe a better metric than this
			if (this.colony.incubator) {
				numWorkersNeeded = 3;
			} else {
				numWorkersNeeded = 1;
			}
			// Only spawn workers once containers are up
			if (numWorkers < numWorkersNeeded && this.room.storageUnits.length > 0) {
				this.colony.hatchery.enqueue(
					new WorkerSetup().create(this.colony, {
						assignment            : this.room.controller!,
						patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
					}));
			}
		}

	}


	// private handleIncubationSpawnOperations(): void { // operations to start up a new room quickly by sending large creeps
	// 	var incubateFlags = _.filter(this.room.assignedFlags,
	// 	                             flag => flagCodes.territory.claimAndIncubate.filter(flag) &&
	// 	                                     flag.room && flag.room.my);
	// 	incubateFlags = _.sortBy(incubateFlags, flag => flag.pathLengthToAssignedRoomStorage);
	// 	for (let flag of incubateFlags) {
	// 	    // Spawn remote miners
	// 	    for (let siteID in flag.colony.miningSites) {
	// 	        let site = flag.colony.miningSites[siteID];
	// 	        let miningPowerAssigned = _.sum(_.map(site.miners, (creep: Creep) => creep.getActiveBodyparts(WORK)));
	// 	        if (miningPowerAssigned < site.miningPowerNeeded) {
	// 	            let protoCreep = new MinerSetup().create(this.colony, {
	// 	                assignment: site.source,
	// 	                patternRepetitionLimit: 3,
	// 	            });
	// 	            protoCreep.memory.colony = flag.room.name;
	// 	            protoCreep.memory.data.renewMe = true;
	// 	            this.colony.hatchery.enqueue(protoCreep);
	// 	        }
	// 	    }
	// 	    // Spawn remote workers
	// 	    let assignedWorkers = flag.room.controller!.getAssignedCreeps('worker');
	// 	    let incubationWorkers = _.filter(assignedWorkers,
	// 	                                     c => c.body.length >= new WorkerSetup().settings.bodyPattern.length *
	// 	                                                           this.settings.workerPatternRepetitionLimit);
	// 	    if (incubationWorkers.length < this.settings.incubationWorkersToSend) {
	// 	        let protoCreep = new WorkerSetup().create(this.colony, {
	// 	            assignment: flag.room.controller!,
	// 	            patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
	// 	        });
	// 	        protoCreep.memory.colony = flag.room.name;
	// 	        protoCreep.memory.data.renewMe = true;
	// 	        this.colony.hatchery.enqueue(protoCreep);
	// 	    }
	// 	}
	// 	// TODO: rewrite this using the core spawn methods + request calls
	// }

	// private handleFlagOperations(): void {
	// 	// Flag operations
	// 	let flags = this.colony.flags;
	// 	var prioritizedFlagOperations = [
	// 		_.filter(flags, flagCodes.millitary.guard.filter),
	// 	];
	//
	// 	// Handle actions associated with assigned flags
	// 	for (let flagPriority of prioritizedFlagOperations) {
	// 		for (let flag of flagPriority) {
	// 			flag.action();
	// 		}
	// 	}
	// }

	// private handleAssignedSpawnOperations(): void { // operations associated with an assigned flags
	// 	// Flag operations
	// 	let flags = this.room.assignedFlags; // TODO: make this a lookup table
	// 	var prioritizedFlagOperations = [
	// 		// _.filter(flags, flagCodes.vision.stationary.filter),
	// 		_.filter(flags, flagCodes.territory.claimAndIncubate.filter),
	// 		// _.filter(flags, flagCodes.millitary.guard.filter),
	// 		// _.filter(flags, flagCodes.territory.colony.filter),
	// 		_.filter(flags, flagCodes.millitary.destroyer.filter),
	// 		_.filter(flags, flagCodes.millitary.sieger.filter),
	// 	];
	//
	// 	// Handle actions associated with assigned flags
	// 	for (let flagPriority of prioritizedFlagOperations) {
	// 		let flagsSortedByRange = _.sortBy(flagPriority, flag => flag.pathLengthToAssignedRoomStorage);
	// 		for (let flag of flagsSortedByRange) {
	// 			flag.action();
	// 		}
	// 	}
	// }

	// /* Handle all types of spawn operations */
	// private handleSpawnOperations(): void {
	// 	if (this.colony.hatchery && this.colony.hatchery.availableSpawns.length > 0) {
	// 		this.handleIncubationSpawnOperations();
	// 		this.handleAssignedSpawnOperations();
	// 	}
	// }

	/* Place new event-driven flags where needed to be instantiated on the next tick */
	private placeDirectives(): void {
		// Place guard flags in the event of an invasion
		for (let room of this.colony.outposts) {
			let guardFlags = _.filter(room.flags, flag => DirectiveGuard.filter(flag));
			if (room.hostiles.length > 0 && guardFlags.length == 0) {
				DirectiveGuard.create(room.hostiles[0].pos);
			}
		}
	}


	// Safe mode condition =============================================================================================

	private handleSafeMode(): void {
		// Simple safe mode handler; will eventually be replaced by something more sophisticated
		// Calls for safe mode when walls are about to be breached and there are non-NPC hostiles in the room
		let criticalBarriers = _.filter(this.room.barriers, s => s.hits < 5000);
		let nonInvaderHostiles = _.filter(this.room.hostiles, creep => creep.owner.username != 'Invader');
		if (criticalBarriers.length > 0 && nonInvaderHostiles.length > 0 && !this.colony.incubator) {
			this.room.controller!.activateSafeMode();
		}
	}

	// Initialization ==================================================================================================

	init(): void {
		this.registerObjectives();
		this.registerCreepRequests();
		// Handle directives
		for (let i in this.directives) {
			this.directives[i].init();
		}
	}

	// Operation =======================================================================================================

	run(): void {
		// Handle directives
		for (let i in this.directives) {
			this.directives[i].run();
		}
		// this.handleFlagOperations();
		this.handleSafeMode();
		// this.handleSpawnOperations(); // build creeps as needed
		this.placeDirectives();
	}
}

profileClass(Overlord);
