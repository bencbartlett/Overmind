/* The Overlord object handles most of the task assignment and directs the spawning operations for each Colony. */

import {DirectiveGuard} from './directives/directive_guard';
import {DirectiveBootstrap, EMERGENCY_ENERGY_THRESHOLD} from './directives/directive_bootstrap';
import {profile} from './lib/Profiler';
import {blankPriorityQueue} from './config/priorities';

@profile
export class Overseer implements IOverseer {
	name: string; 								// Name of the primary colony room
	memory: OverseerMemory; 					// Memory.colony.overseer
	// room: Room; 								// Colony room
	colony: IColony; 							// Instantiated colony object
	// directives: Directive[]; 					// Directives for response to stimuli
	// private objectivePriorities: string[]; 		// Prioritization for objectives in the objectiveGroup
	// objectiveGroup: ObjectiveGroup; 			// Box for objectives assignable from this object
	directives: IDirective[];					// Directives across the colony
	overlords: {
		[priority: number]: IOverlord[]
	};
	// settings: {									// Adjustable settings
	// 	incubationWorkersToSend: number,			// number of big workers to send to incubate a room
	// 	storageBuffer: { [role: string]: number },	// creeps of a given role can't withdraw until this level
	// 	unloadStorageBuffer: number,				// start sending energy to other rooms past this amount
	// 	maxAssistLifetimePercentage: number,		// assist in spawn operations up to (creep.lifetime * this) distance
	// 	workerPatternRepetitionLimit: number,		// maximum worker size
	// };

	constructor(colony: IColony) {
		this.name = colony.name;
		// this.room = colony.room;
		this.colony = colony;
		this.memory = colony.memory.overseer;
		// // Priority that objectives should be performed in
		// this.objectivePriorities = [
		// 	'supplyTower',
		// 	'supply',
		// 	'pickupEnergy',
		// 	'collectEnergyMiningSite',
		// 	'collectEnergyContainer',
		// 	'depositContainer',
		// 	'build',
		// 	'repair',
		// 	'buildRoad',
		// 	'fortify',
		// 	'upgrade',
		// ];
		// // Instantiate objective and resource request groups
		// this.objectiveGroup = new ObjectiveGroup(this.objectivePriorities);
		// Configurable settings
		// this.settings = {
		// 	incubationWorkersToSend     : 3,
		// 	storageBuffer               : {
		// 		manager : 75000,
		// 		worker  : 50000,
		// 		upgrader: 75000,
		// 	},
		// 	unloadStorageBuffer         : 750000,
		// 	maxAssistLifetimePercentage : 0.1,
		// 	workerPatternRepetitionLimit: Infinity,
		// };
		// Placeholder array for directives, filled in by Overmind
		this.directives = [];
		this.overlords = blankPriorityQueue();
	}


	// Objective management ============================================================================================

	// /* Register objectives from across the colony in the objectiveGroup. Some objectives are registered by other
	//  * colony objects, like Hatchery and CommandCenter objectives. */
	// private registerObjectives(): void {
	// 	// Collect energy from component sites that have requested a hauler/supplier withdrawal
	// 	let withdrawalRequests = _.filter(this.transportRequests.withdraw.haul,
	// 									  request => request.resourceType == RESOURCE_ENERGY);
	// 	let collectContainers = _.map(withdrawalRequests, request => request.target);
	// 	let collectEnergyMiningSiteObjectives = _.map(collectContainers, container =>
	// 		new ObjectiveCollectEnergyMiningSite(container as StructureContainer));
	//
	// 	// Deposit energy to containers requesting a refill
	// 	let depositRequests = _.filter(this.transportRequests.supply.haul,
	// 								   request => request.resourceType == RESOURCE_ENERGY);
	// 	let depositContainers = _.map(depositRequests, request => request.target);
	// 	let depositContainerObjectives = _.map(depositContainers, container =>
	// 		new ObjectiveDepositContainer(container as StructureContainer));
	//
	// 	this.objectiveGroup.registerObjectives(collectEnergyMiningSiteObjectives, depositContainerObjectives);
	//
	// 	// Register tasks across all rooms in colony
	// 	for (let room of this.colony.rooms) {
	// 		// Pick up energy
	// 		let droppedEnergy: Resource[] = _.filter(room.droppedEnergy, d => d.amount > 100);
	// 		let pickupEnergyObjectives = _.map(droppedEnergy, target => new ObjectivePickupEnergy(target));
	//
	// 		// Repair structures
	// 		let repairStructures = _.filter(room.repairables,
	// 										s => s.hits < s.hitsMax &&
	// 											 (s.structureType != STRUCTURE_CONTAINER || s.hits < 0.7 * s.hitsMax) &&
	// 											 (s.structureType != STRUCTURE_ROAD || s.hits < 0.7 * s.hitsMax));
	// 		let repairObjectives = _.map(repairStructures, target => new ObjectiveRepair(target));
	//
	// 		// Build construction jobs that aren't roads
	// 		let buildObjectives = _.map(room.structureSites, site => new ObjectiveBuild(site));
	//
	// 		// Build roads
	// 		let buildRoadObjectives = _.map(room.roadSites, site => new ObjectiveBuildRoad(site));
	//
	// 		// Fortify barriers
	// 		let fortifyObjectives: IObjective[] = [];
	// 		if (!this.colony.incubator) {
	// 			let lowestBarriers = _.sortBy(room.barriers, barrier => barrier.hits).slice(0, 5);
	// 			fortifyObjectives = _.map(lowestBarriers, barrier => new ObjectiveFortify(barrier));
	// 		}
	//
	// 		// Upgrade controller
	// 		let upgradeObjectives: IObjective[] = [];
	// 		if (room.controller) {
	// 			upgradeObjectives = [new ObjectiveUpgrade(room.controller)];
	// 		}
	//
	// 		// Register the objectives in the objectiveGroup
	// 		this.objectiveGroup.registerObjectives(pickupEnergyObjectives,
	// 											   repairObjectives,
	// 											   buildObjectives,
	// 											   buildRoadObjectives,
	// 											   fortifyObjectives,
	// 											   upgradeObjectives);
	// 	}
	// }
	//
	// /* Assign a task to a creep. Uses the default ObjectiveGroup assignment logic. */
	// assignTask(creep: Zerg): void {
	// 	this.objectiveGroup.assignTask(creep);
	// }
	//
	//
	// // Spawner operations ==============================================================================================
	//
	// /* Handle remaining creep spawning requirements for homeostatic processes which aren't handled by hiveClusters.
	//  * Injects protocreeps into a priority queue in Hatchery. Other spawn operations are done with directives. */
	// private registerCreepRequests(): void {
	// 	if (this.colony.hatchery) {
	// 		// Ensure there's a mineral supplier for the labs
	// 		if (this.room.terminal && this.room.labs.length > 0) {
	// 			if (this.colony.getCreepsByRole('mineralSupplier').length < 1) {
	// 				this.colony.hatchery.enqueue(
	// 					new MineralSupplierSetup().create(this.colony, {
	// 						assignment            : this.room.terminal,
	// 						patternRepetitionLimit: 1,
	// 					}));
	// 			}
	// 		}
	//
	// 		// Ensure there's enough workers
	// 		let numWorkers = this.colony.getCreepsByRole('worker').length;
	// 		let numWorkersNeeded; // TODO: maybe a better metric than this
	// 		if (this.colony.incubator) {
	// 			numWorkersNeeded = 3;
	// 		} else {
	// 			numWorkersNeeded = 1;
	// 		}
	// 		// Only spawn workers once containers are up
	// 		if (numWorkers < numWorkersNeeded && this.room.storageUnits.length > 0) {
	// 			this.colony.hatchery.enqueue(
	// 				new WorkerSetup().create(this.colony, {
	// 					assignment            : this.room.controller!,
	// 					patternRepetitionLimit: this.settings.workerPatternRepetitionLimit,
	// 				}));
	// 		}
	// 	}
	// }

	/* Place new event-driven flags where needed to be instantiated on the next tick */
	private placeDirectives(): void {
		// Guard directive: defend your outposts and all rooms of colonies that you are incubating
		let roomsToCheck = _.flattenDeep([this.colony.outposts,
										  _.map(this.colony.incubatingColonies, col => col.rooms)]) as Room[];
		for (let room of roomsToCheck) {
			let guardFlags = _.filter(room.flags, DirectiveGuard.filter);
			if (room.hostiles.length > 0 && guardFlags.length == 0) {
				DirectiveGuard.create(room.hostiles[0].pos);
			}
		}

		// Emergency directive: in the event of catastrophic room crash, enter emergency spawn mode.
		// Doesn't apply to incubating colonies.
		if (!this.colony.isIncubating) {
			let hasEnergy = this.colony.room.energyAvailable >= EMERGENCY_ENERGY_THRESHOLD; 		// Enough spawn energy?
			let hasMiners = this.colony.getCreepsByRole('miner').length > 0;
			let hasSupplier = this.colony.getCreepsByRole('supplier').length > 0;
			// let hasEnergySupply = (this.room.storage != undefined &&						// Has storage and
			// 					   this.room.storage.energy > EMERGENCY_ENERGY_THRESHOLD && // energy in storage and
			// 					   this.colony.getCreepsByRole('supplier').length > 0);		// can carry to spawn?
			// let hasLogistics = (this.colony.getCreepsByRole('supplier').length > 0 ||
			// 					this.colony.getCreepsByRole('queen').length > 0);
			// let roomHasMiners = this.colony.getCreepsByRole('miner').length > 0;				// Has miners?
			let emergencyFlags = _.filter(this.colony.room.flags, DirectiveBootstrap.filter);
			if (!hasEnergy && !hasMiners && !hasSupplier && emergencyFlags.length == 0) {
				DirectiveBootstrap.create(this.colony.hatchery!.pos);
			}
		}
	}


	// Safe mode condition =============================================================================================

	private handleSafeMode(): void {
		// Simple safe mode handler; will eventually be replaced by something more sophisticated
		// Calls for safe mode when walls are about to be breached and there are non-NPC hostiles in the room
		let criticalBarriers = _.filter(this.colony.room.barriers, s => s.hits < 5000);
		let nonInvaderHostiles = _.filter(this.colony.room.hostiles, creep => creep.owner.username != 'Invader');
		if (criticalBarriers.length > 0 && nonInvaderHostiles.length > 0 && !this.colony.isIncubating) {
			this.colony.room.controller!.activateSafeMode();
		}
	}

	build(): void {

	}

	// Initialization ==================================================================================================

	init(): void {
		// Handle directives - should be done first
		for (let i in this.directives) {
			this.directives[i].init();
		}
		// Handle overlords in decreasing priority {
		for (let priority in this.overlords) {
			for (let overlord of this.overlords[priority]) {
				overlord.init();
			}
		}
		// this.registerObjectives();
		// this.registerCreepRequests();
	}

	// Operation =======================================================================================================

	run(): void {
		// Handle directives
		for (let i in this.directives) {
			this.directives[i].run();
		}
		// Handle overlords in decreasing priority {
		for (let priority in this.overlords) {
			for (let overlord of this.overlords[priority]) {
				overlord.run();
			}
		}
		// this.handleFlagOperations();
		this.handleSafeMode();
		// this.handleSpawnOperations(); // build creeps as needed
		this.placeDirectives();
	}
}
