/* The Overlord object handles most of the task assignment and directs the spawning operations for each Colony. */

import {DirectiveGuard} from './directives/directive_guard';
import {DirectiveBootstrap, EMERGENCY_ENERGY_THRESHOLD} from './directives/directive_bootstrap';
import {profile} from './lib/Profiler';
import {blankPriorityQueue} from './config/priorities';
import {Colony} from './Colony';
import {Overlord} from './overlords/Overlord';
import {Directive} from './directives/Directive';

@profile
export class Overseer {
	memory: OverseerMemory; 					// Memory.colony.overseer
	colony: Colony; 							// Instantiated colony object
	directives: Directive[];					// Directives across the colony
	overlords: {
		[priority: number]: Overlord[]
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.memory = colony.memory.overseer;
		this.directives = [];
		this.overlords = blankPriorityQueue();
	}

	/* Place new event-driven flags where needed to be instantiated on the next tick */
	private placeDirectives(): void {
		// Guard directive: defend your outposts and all rooms of colonies that you are incubating
		let roomsToCheck = _.flattenDeep([this.colony.outposts,
										  _.map(this.colony.incubatingColonies, col => col.rooms)]) as Room[];
		for (let room of roomsToCheck) {
			let guardFlags = _.filter(room.flags, flag => DirectiveGuard.filter(flag));
			if (room.hostiles.length > 0 && guardFlags.length == 0) {
				DirectiveGuard.create(room.hostiles[0].pos);
			}
		}

		// Emergency directive: in the event of catastrophic room crash, enter emergency spawn mode.
		// Doesn't apply to incubating colonies.
		if (!this.colony.isIncubating) {
			let hasEnergy = this.colony.room.energyAvailable >= EMERGENCY_ENERGY_THRESHOLD; // Enough spawn energy?
			let hasMiners = this.colony.getCreepsByRole('miner').length > 0;		// Has energy supply?
			let hasSupplier = this.colony.getCreepsByRole('supplier').length > 0;	// Has suppliers?
			// let canSpawnSupplier = this.colony.room.energyAvailable >= this.colony.overlords.supply.generateProtoCreep()
			let emergencyFlags = _.filter(this.colony.room.flags, flag => DirectiveBootstrap.filter(flag));
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
		_.forEach(this.directives, directive => directive.init());
		// Handle overlords in decreasing priority {
		for (let priority in this.overlords) {
			if (!this.overlords[priority]) continue;
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
		_.forEach(this.directives, directive => directive.run());
		// Handle overlords in decreasing priority {
		for (let priority in this.overlords) {
			if (!this.overlords[priority]) continue;
			for (let overlord of this.overlords[priority]) {
				overlord.run();
			}
		}
		// this.handleFlagOperations();
		this.handleSafeMode();
		// this.handleSpawnOperations(); // build creeps as needed
		this.placeDirectives();
		// Draw visuals
		_.forEach(this.directives, directive => directive.visuals());
	}
}
