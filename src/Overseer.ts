/* The Overlord object handles most of the task assignment and directs the spawning operations for each Colony. */

import {DirectiveGuard} from './directives/defense/guard';
import {DirectiveBootstrap, EMERGENCY_ENERGY_THRESHOLD} from './directives/core/bootstrap';
import {profile} from './profiler/decorator';
import {Colony, ColonyStage} from './Colony';
import {Overlord} from './overlords/Overlord';
import {Directive} from './directives/Directive';
import {log} from './console/log';
import {Visualizer} from './visuals/Visualizer';
import {Pathing} from './movement/Pathing';
import {DirectiveGuardSwarm} from './directives/defense/guardSwarm';
import {DirectiveInvasionDefense} from './directives/defense/invasionDefense';
import {Mem} from './Memory';
import {DirectiveNukeResponse} from './directives/defense/nukeResponse';
import {DirectiveEvacuateTerminal} from './directives/logistics/evacuateTerminal';
import {MinerSetup} from './overlords/core/miner';
import {QueenSetup} from './overlords/core/queen';

@profile
export class Overseer {
	colony: Colony; 							// Instantiated colony object
	directives: Directive[];					// Directives across the colony
	overlords: {
		[priority: number]: Overlord[]
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.directives = [];
		this.overlords = {};
	}

	get memory(): OverseerMemory {
		return Mem.wrap(this.colony.memory, 'overseer', {});
	}

	registerOverlord(overlord: Overlord): void {
		if (!this.overlords[overlord.priority]) {
			this.overlords[overlord.priority] = [];
		}
		this.overlords[overlord.priority].push(overlord);
	}

	/* Place new event-driven flags where needed to be instantiated on the next tick */
	private placeDirectives(): void {
		// Bootstrap directive: in the event of catastrophic room crash, enter emergency spawn mode.
		// Doesn't apply to incubating colonies.
		if (!this.colony.isIncubating) {
			let hasEnergy = this.colony.room.energyAvailable >= EMERGENCY_ENERGY_THRESHOLD; // Enough spawn energy?
			let hasMiners = this.colony.getCreepsByRole(MinerSetup.role).length > 0;		// Has energy supply?
			let hasQueen = this.colony.getCreepsByRole(QueenSetup.role).length > 0;			// Has a queen?
			if (!hasEnergy && !hasMiners && !hasQueen && this.colony.hatchery) {
				DirectiveBootstrap.createIfNotPresent(this.colony.hatchery.pos, 'pos');
				// this.colony.hatchery.settings.suppressSpawning = true;
			}
		}

		// TODO: figure out what's causing these bugs
		// // Register logistics requests for all dropped resources and tombstones
		// for (let room of this.colony.rooms) {
		// 	// Pick up all nontrivial dropped resources
		// 	for (let resourceType in room.drops) {
		// 		for (let drop of room.drops[resourceType]) {
		// 			if (drop.amount > 200 || drop.resourceType != RESOURCE_ENERGY) {
		// 				DirectivePickup.createIfNotPresent(drop.pos, 'pos', {quiet: true});
		// 			}
		// 		}
		// 	}
		// }
		// // Place a logistics request directive for every tombstone with non-empty store that isn't on a container
		// for (let tombstone of this.colony.tombstones) {
		// 	if (_.sum(tombstone.store) > 0 && !tombstone.pos.lookForStructure(STRUCTURE_CONTAINER)) {
		// 		DirectivePickup.createIfNotPresent(tombstone.pos, 'pos', {quiet: true});
		// 	}
		// }

		// Guard directive: defend your outposts and all rooms of colonies that you are incubating
		let roomsToCheck = _.flattenDeep([this.colony.outposts,
										  _.map(this.colony.incubatingColonies, col => col.rooms)]) as Room[];
		for (let room of roomsToCheck) {
			let defenseFlags = _.filter(room.flags, flag => DirectiveGuard.filter(flag) ||
															DirectiveInvasionDefense.filter(flag) ||
															DirectiveGuardSwarm.filter(flag));
			// let bigHostiles = _.filter(room.hostiles, creep => creep.body.length >= 10);
			if (room.dangerousHostiles.length > 0 && defenseFlags.length == 0) {
				DirectiveGuard.create(room.dangerousHostiles[0].pos);
			}
		}

		// Defend against invasions in owned rooms
		if (this.colony.room && this.colony.level >= DirectiveInvasionDefense.requiredRCL) {
			let effectiveInvaderCount = _.sum(_.map(this.colony.room.hostiles,
													invader => invader.boosts.length > 0 ? 2 : 1));
			if (effectiveInvaderCount >= 3) {
				DirectiveInvasionDefense.createIfNotPresent(this.colony.controller.pos, 'room');
			}
		}

		// Place nuke response directive if there is a nuke present in colony room
		if (this.colony.room && this.colony.level >= DirectiveNukeResponse.requiredRCL) {
			for (let nuke of this.colony.room.find(FIND_NUKES)) {
				DirectiveNukeResponse.createIfNotPresent(nuke.pos, 'pos');
			}
		}

		// Place an abandon directive in case room has been breached to prevent terminal robbing
		// if (this.colony.breached && this.colony.terminal) {
		// 	DirectiveEvacuateTerminal.createIfNotPresent(this.colony.terminal.pos, 'room');
		// }
	}


	// Safe mode condition =============================================================================================

	private handleSafeMode(): void {
		// Safe mode activates when there are dangerous player hostiles that can reach the spawn
		let criticalStructures = _.compact([...this.colony.spawns,
											this.colony.storage,
											this.colony.terminal]) as Structure[];
		for (let structure of criticalStructures) {
			if (structure.hits < structure.hitsMax &&
				structure.pos.findInRange(this.colony.room.dangerousHostiles, 1).length > 0) {
				let ret = this.colony.controller.activateSafeMode();
				if (ret != OK && !this.colony.controller.safeMode) {
					if (this.colony.terminal) {
						DirectiveEvacuateTerminal.createIfNotPresent(this.colony.terminal.pos, 'room');
					}
				}
				return;
			}
		}
		if (this.colony.stage > ColonyStage.Larva) {
			let barriers = _.map(this.colony.room.barriers, barrier => barrier.pos);
			let firstHostile = _.first(this.colony.room.dangerousHostiles);
			if (firstHostile && this.colony.spawns[0] &&
				Pathing.isReachable(firstHostile.pos, this.colony.spawns[0].pos, {obstacles: barriers})) {
				let ret = this.colony.controller.activateSafeMode();
				if (ret != OK && !this.colony.controller.safeMode) {
					if (this.colony.terminal) {
						DirectiveEvacuateTerminal.createIfNotPresent(this.colony.terminal.pos, 'room');
					}
				}
				return;
			}
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
		this.handleSafeMode();
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
						if (Game.time % 100 == 0) {
							log.info(`Role ${role} is not reported by ${overlord.name}!`);
						}
					} else {
						if (!roleOccupancy[role]) roleOccupancy[role] = [0, 0];
						roleOccupancy[role][0] += report[0];
						roleOccupancy[role][1] += report[1];
					}
				}
			}
		}
		let safeOutposts = _.filter(this.colony.outposts, room => !!room && room.dangerousHostiles.length == 0);
		let stringReport: string[] = [
			`DEFCON: ${this.colony.defcon}  Safe outposts: ${safeOutposts.length}/${this.colony.outposts.length}`,
			`Creep usage for ${this.colony.name}:`];
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
