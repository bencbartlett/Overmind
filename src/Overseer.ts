/* The Overlord object handles most of the task assignment and directs the spawning operations for each Colony. */

import {DirectiveGuard} from './directives/combat/directive_guard';
import {DirectiveBootstrap, EMERGENCY_ENERGY_THRESHOLD} from './directives/core/directive_bootstrap';
import {profile} from './lib/Profiler';
import {Colony} from './Colony';
import {Overlord} from './overlords/Overlord';
import {Directive} from './directives/Directive';
import {log} from './lib/logger/log';
import {Visualizer} from './visuals/Visualizer';
import {Pathing} from './pathing/pathing';
import {DirectiveGuardSwarm} from './directives/combat/directive_guard_swarm';

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
		this.overlords = {};
	}

	registerOverlord(overlord: Overlord): void {
		if (!this.overlords[overlord.priority]) {
			this.overlords[overlord.priority] = [];
		}
		this.overlords[overlord.priority].push(overlord);
	}

	/* Place new event-driven flags where needed to be instantiated on the next tick */
	private placeDirectives(): void {
		// Guard directive: defend your outposts and all rooms of colonies that you are incubating
		let roomsToCheck = _.flattenDeep([this.colony.outposts,
										  _.map(this.colony.incubatingColonies, col => col.rooms)]) as Room[];
		for (let room of roomsToCheck) {
			let guardFlags = _.filter(room.flags, flag => DirectiveGuard.filter(flag));
			let guardSwarmFlags = _.filter(room.flags, flag => DirectiveGuardSwarm.filter(flag));
			let bigHostiles = _.filter(room.hostiles, creep => creep.body.length >= 10);
			// let hostiles = _.filter(room.hostiles, creep => creep.getActiveBodyparts(ATTACK) > 0 ||
			// 												creep.getActiveBodyparts(WORK) > 0 ||
			// 												creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
			// 												creep.getActiveBodyparts(HEAL) > 0);
			if ((room.hostiles.length > 0 && guardFlags.length + guardSwarmFlags.length == 0) ||
				(bigHostiles.length > 0 && guardFlags.length == 0)) {
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
				if (this.colony.hatchery) {
					DirectiveBootstrap.create(this.colony.hatchery.pos);
				}
			}
		}
	}


	// Safe mode condition =============================================================================================

	private handleSafeMode(): void {
		// Simple safe mode handler; will eventually be replaced by something more sophisticated
		// Calls for safe mode when walls are about to be breached and there are non-NPC hostiles in the room
		let creepIsDangerous = (creep: Creep) => (creep.getActiveBodyparts(ATTACK) > 0 ||
												  creep.getActiveBodyparts(RANGED_ATTACK) > 0);
		let nonInvaderHostiles = _.filter(this.colony.room.hostiles, creep => creep.owner.username != 'Invader' &&
																			  creepIsDangerous(creep));
		let hostilesCanReachSpawn = false;
		if (this.colony.spawns[0] && nonInvaderHostiles.length > 0) {
			let obstacles = _.map(this.colony.room.barriers, barrier => barrier.pos);
			let ret = Pathing.findShortestPath(nonInvaderHostiles[0].pos, this.colony.spawns[0].pos,
											   {obstacles: obstacles});
			if (!ret.incomplete) hostilesCanReachSpawn = true;
		}
		if (nonInvaderHostiles.length > 0 && hostilesCanReachSpawn) {
			this.colony.controller.activateSafeMode();
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
		// Handle overlords in decreasing priority
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

	visuals(): void {
		let roleOccupancy: { [role: string]: [number, number] } = {};
		// Handle overlords in decreasing priority
		for (let priority in this.overlords) {
			if (!this.overlords[priority]) continue;
			for (let overlord of this.overlords[priority]) {
				for (let role in overlord.creepUsageReport) {
					let report = overlord.creepUsageReport[role];
					if (!report) {
						log.info(`Role ${role} is not reported by ${overlord.name}!`);
					} else {
						if (!roleOccupancy[role]) roleOccupancy[role] = [0, 0];
						roleOccupancy[role][0] += report[0];
						roleOccupancy[role][1] += report[1];
					}
				}
			}
		}
		let stringReport: string[] = [`Creep usage for ${this.colony.name}:`];
		let padLength = _.max(_.map(_.keys(roleOccupancy), str => str.length)) + 2;
		for (let role in roleOccupancy) {
			let [current, needed] = roleOccupancy[role];
			if (needed > 0) {
				stringReport.push('| ' + `${role}:`.padRight(padLength) +
								  `${Math.floor(100 * current / needed)}%`.padLeft(4));
			}
		}
		Visualizer.colonyReport(this.colony.name, stringReport);
	}
}
