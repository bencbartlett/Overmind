/* The Overlord object handles most of the task assignment and directs the spawning operations for each Colony. */

import {DirectiveGuard} from './directives/defense/guard';
import {DirectiveBootstrap} from './directives/core/bootstrap';
import {profile} from './profiler/decorator';
import {Colony, ColonyStage} from './Colony';
import {Overlord} from './overlords/Overlord';
import {Directive} from './directives/Directive';
import {log} from './console/log';
import {Visualizer} from './visuals/Visualizer';
import {Pathing} from './movement/Pathing';
import {DirectiveInvasionDefense} from './directives/defense/invasionDefense';
import {DirectiveNukeResponse} from './directives/defense/nukeResponse';
import {DirectiveTerminalEvacuateState} from './directives/logistics/terminalState_evacuate';
import {bodyCost} from './creepSetups/CreepSetup';
import {LogisticsNetwork} from './logistics/LogisticsNetwork';
import {Cartographer, ROOMTYPE_CONTROLLER, ROOMTYPE_SOURCEKEEPER} from './utilities/Cartographer';
import {derefCoords, hasJustSpawned, minBy} from './utilities/utils';
import {DirectiveOutpost} from './directives/core/outpost';
import {Autonomy, getAutonomyLevel} from './memory/Memory';
import {RoomIntel} from './intel/RoomIntel';
import {Roles, Setups} from './creepSetups/setups';


// export const DIRECTIVE_CHECK_FREQUENCY = 2;

@profile
export class Overseer {

	colony: Colony; 							// Instantiated colony object
	directives: Directive[];					// Directives across the colony
	// overlords: {
	// 	[priority: number]: Overlord[]
	// };
	overlords: Overlord[];
	private overlordRequests: Overlord[];

	static settings = {
		outpostCheckFrequency: 250
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.directives = [];
		this.overlords = [];
		this.overlordRequests = [];
	}

	refresh() {
		// this.directives = [];
		// this.overlords = {};
		// this.overlordRequests = [];
	}

	registerOverlord(overlord: Overlord): void {
		this.overlords.push(overlord);
	}

	private registerLogisticsRequests(): void {
		// Register logistics requests for all dropped resources and tombstones
		for (let room of this.colony.rooms) {
			// Pick up all nontrivial dropped resources
			for (let resourceType in room.drops) {
				for (let drop of room.drops[resourceType]) {
					if (drop.amount > LogisticsNetwork.settings.droppedEnergyThreshold
						|| drop.resourceType != RESOURCE_ENERGY) {
						this.colony.logisticsNetwork.requestOutput(drop);
					}
				}
			}
		}
		// Place a logistics request directive for every tombstone with non-empty store that isn't on a container
		for (let tombstone of this.colony.tombstones) {
			if (_.sum(tombstone.store) > LogisticsNetwork.settings.droppedEnergyThreshold
				|| _.sum(tombstone.store) > tombstone.store.energy) {
				if (this.colony.bunker && tombstone.pos.isEqualTo(this.colony.bunker.anchor)) continue;
				this.colony.logisticsNetwork.requestOutput(tombstone, {resourceType: 'all'});
			}
		}
	}

	private handleBootstrapping() {
		// Bootstrap directive: in the event of catastrophic room crash, enter emergency spawn mode.
		// Doesn't apply to incubating colonies.
		if (!this.colony.isIncubating) {
			let noQueen = this.colony.getCreepsByRole(Roles.queen).length == 0;
			if (noQueen && this.colony.hatchery && !this.colony.spawnGroup) {
				let energyToMakeQueen = bodyCost(Setups.queen.generateBody(this.colony.room.energyCapacityAvailable));
				if (this.colony.room.energyAvailable < energyToMakeQueen || hasJustSpawned()) {
					let result = DirectiveBootstrap.createIfNotPresent(this.colony.hatchery.pos, 'pos');
					if (typeof result == 'string' || result == OK) { // successfully made flag
						this.colony.hatchery.settings.suppressSpawning = true;
					}
				}
			}
		}
	}

	private handleOutpostGuards() {
		// Guard directive: defend your outposts and all rooms of colonies that you are incubating
		for (let room of this.colony.outposts) {
			if (Cartographer.roomType(room.name) != ROOMTYPE_SOURCEKEEPER) { // SK rooms can fend for themselves
				let defenseFlags = _.filter(room.flags, flag => DirectiveGuard.filter(flag) ||
																DirectiveInvasionDefense.filter(flag));
				if (room.dangerousHostiles.length > 0 && defenseFlags.length == 0) {
					DirectiveGuard.create(room.dangerousHostiles[0].pos);
				}
			}
		}
	}

	private handleColonyInvasions() {
		// Defend against invasions in owned rooms
		if (this.colony.room && this.colony.level >= DirectiveInvasionDefense.requiredRCL) {
			let effectiveInvaderCount = _.sum(_.map(this.colony.room.hostiles,
													invader => invader.boosts.length > 0 ? 2 : 1));
			if (effectiveInvaderCount >= 3 || this.colony.room.dangerousPlayerHostiles.length > 0) {
				DirectiveInvasionDefense.createIfNotPresent(this.colony.controller.pos, 'room');
			}
		}
	}

	private handleNukeResponse() {
		// Place nuke response directive if there is a nuke present in colony room
		if (this.colony.room && this.colony.level >= DirectiveNukeResponse.requiredRCL) {
			for (let nuke of this.colony.room.find(FIND_NUKES)) {
				DirectiveNukeResponse.createIfNotPresent(nuke.pos, 'pos');
			}
		}
	}

	private handleNewOutposts() {
		let numSources = _.sum(this.colony.roomNames, roomName => (Memory.rooms[roomName].src || []).length);
		let numRemotes = numSources - this.colony.room.sources.length;
		if (numRemotes < Colony.settings.remoteSourcesByLevel[this.colony.level]) {
			// Possible outposts are controller rooms not already reserved or owned
			log.debug(`Calculating colonies for ${this.colony.room.print}...`);
			log.debug(`Rooms in range 2: ${Cartographer.findRoomsInRange(this.colony.room.name, 2)}`);
			let possibleOutposts = _.filter(Cartographer.findRoomsInRange(this.colony.room.name, 2), roomName =>
				Cartographer.roomType(roomName) == ROOMTYPE_CONTROLLER
				&& !_.any(Overmind.cache.outpostFlags,
						  function (flag) {
							  if (flag.memory.setPosition) {
								  return flag.memory.setPosition.roomName == roomName;
							  } else {
								  return flag.pos.roomName == roomName;
							  }
						  })
				&& !Overmind.colonies[roomName]
				&& !RoomIntel.roomOwnedBy(roomName)
				&& !RoomIntel.roomReservedBy(roomName)
				&& Game.map.isRoomAvailable(roomName));
			log.debug(`Possible outposts: ${possibleOutposts}`);
			let origin = this.colony.pos;
			let bestOutpost = minBy(possibleOutposts, function (roomName) {
				if (!Memory.rooms[roomName]) return false;
				let sourceCoords = Memory.rooms[roomName].src as SavedSource[] | undefined;
				if (!sourceCoords) return false;
				let sourcePositions = _.map(sourceCoords, src => derefCoords(src.c, roomName));
				let sourceDistances = _.map(sourcePositions, pos => Pathing.distance(origin, pos));
				if (_.any(sourceDistances, dist => dist == undefined
												   || dist > Colony.settings.maxSourceDistance)) return false;
				return _.sum(sourceDistances) / sourceDistances.length;
			});
			if (bestOutpost) {
				let pos = Pathing.findPathablePosition(bestOutpost);
				log.info(`Colony ${this.colony.room.print} now remote mining from ${pos.print}`);
				DirectiveOutpost.createIfNotPresent(pos, 'room', {memory: {colony: this.colony.name}});
			}
		}
	}

	/* Place new event-driven flags where needed to be instantiated on the next tick */
	private placeDirectives(): void {
		this.handleBootstrapping();
		this.handleOutpostGuards();
		this.handleColonyInvasions();
		this.handleNukeResponse();
		if (Game.time % Overseer.settings.outpostCheckFrequency == 2 * this.colony.id
			&& getAutonomyLevel() > Autonomy.Manual) {
			this.handleNewOutposts();
		}
	}


	// Safe mode condition =============================================================================================

	private handleSafeMode(): void {
		if (this.colony.stage == ColonyStage.Larva) {
			return;
		}
		// Safe mode activates when there are dangerous player hostiles that can reach the spawn
		let criticalStructures = _.compact([...this.colony.spawns,
											this.colony.storage,
											this.colony.terminal]) as Structure[];
		for (let structure of criticalStructures) {
			if (structure.hits < structure.hitsMax &&
				structure.pos.findInRange(this.colony.room.dangerousHostiles, 2).length > 0) {
				let ret = this.colony.controller.activateSafeMode();
				if (ret != OK && !this.colony.controller.safeMode) {
					if (this.colony.terminal) {
						DirectiveTerminalEvacuateState.createIfNotPresent(this.colony.terminal.pos, 'room');
					}
				} else {
					return;
				}
			}
		}
		let firstHostile = _.first(this.colony.room.dangerousHostiles);
		if (firstHostile && this.colony.spawns[0]) {
			let barriers = _.map(this.colony.room.barriers, barrier => barrier.pos);
			if (Pathing.isReachable(firstHostile.pos, this.colony.spawns[0].pos, barriers)) {
				let ret = this.colony.controller.activateSafeMode();
				if (ret != OK && !this.colony.controller.safeMode) {
					if (this.colony.terminal) {
						DirectiveTerminalEvacuateState.createIfNotPresent(this.colony.terminal.pos, 'room');
					}
				} else {
					return;
				}
			}
		}
	}

	build(): void {

	}

	// Initialization ==================================================================================================

	// private buildOverlordPriorityQueue(): void {
	// 	for (let overlord of this.overlordRequests) {
	// 		if (!this.overlords[overlord.priority]) {
	// 			this.overlords[overlord.priority] = [];
	// 		}
	// 		this.overlords[overlord.priority].push(overlord);
	// 	}
	// }

	init(): void {
		// this.buildOverlordPriorityQueue();
		// Handle directives - should be done first
		// _.forEach(this.directives, directive => directive.init());
		// Handle overlords in decreasing priority
		// for (let priority in this.overlords) {
		// 	if (!this.overlords[priority]) continue;
		// 	for (let overlord of this.overlords[priority]) {
		// 		overlord.init();
		// 	}
		// }
		for (let directive of this.directives) {
			directive.init();
		}
		for (let overlord of this.overlords) {
			overlord.preInit();
			overlord.init();
		}
		// Register cleanup requests to logistics network
		this.registerLogisticsRequests();
	}

	// Operation =======================================================================================================

	run(): void {
		// Handle directives
		// _.forEach(this.directives, directive => directive.run());
		// Handle overlords in decreasing priority
		// for (let priority in this.overlords) {
		// 	overlord.run();
		// 	for (let overlord of this.overlords[priority]) {
		// 		overlord.run();
		// 	}
		// }
		for (let directive of this.directives) {
			directive.run();
		}
		for (let overlord of this.overlords) {
			overlord.run();
		}
		this.handleSafeMode();
		// if (Game.time % DIRECTIVE_CHECK_FREQUENCY == this.colony.id % DIRECTIVE_CHECK_FREQUENCY) {
		this.placeDirectives();
		// }
	}

	private drawCreepReport() {
		const spoopyBugFix = false;
		let roleOccupancy: { [role: string]: [number, number] } = {};

		for (let overlord of this.overlords) {
			for (let role in overlord.creepUsageReport) {
				let report = overlord.creepUsageReport[role];
				if (report == undefined) {
					if (Game.time % 100 == 0) {
						log.info(`Role ${role} is not reported by ${overlord.ref}!`);
					}
				} else {
					if (roleOccupancy[role] == undefined) {
						roleOccupancy[role] = [0, 0];
					}
					roleOccupancy[role][0] += report[0];
					roleOccupancy[role][1] += report[1];
					if (spoopyBugFix) { // bizzarely, if you comment these lines out, the creep report is incorrect
						log.debug(`report: ${JSON.stringify(report)}`);
						log.debug(`occupancy: ${JSON.stringify(roleOccupancy)}`);
					}
				}
			}
		}

		let safeOutposts = _.filter(this.colony.outposts, room => !!room && room.dangerousHostiles.length == 0);
		let stringReport: string[] = [
			`DEFCON: ${this.colony.defcon}  Safe outposts: ${safeOutposts.length}/${this.colony.outposts.length}`,
			`Creep usage for ${this.colony.name}:`];


		// let padLength = _.max(_.map(_.keys(roleOccupancy), str => str.length)) + 2;
		let roledata: string[][] = [];
		for (let role in roleOccupancy) {
			let [current, needed] = roleOccupancy[role];
			// if (needed > 0) {
			// 	stringReport.push('| ' + `${role}:`.padRight(padLength) +
			// 					  `${Math.floor(100 * current / needed)}%`.padLeft(4));
			// }
			roledata.push([role, `${current}/${needed}`]);
		}
		const tablePos = new RoomPosition(1, 11.5, this.colony.room.name);
		Visualizer.infoBox(`${this.colony.name} Creeps`, roledata, tablePos, 7);
	}

	visuals(): void {
		for (let directive of this.directives) {
			directive.visuals();
		}
		for (let overlord of this.overlords) {
			overlord.visuals();
		}
		this.drawCreepReport();
	}
}
