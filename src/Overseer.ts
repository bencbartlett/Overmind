/* The Overseer object acts as a scheduler, running directives and overlords for all colonies each tick. It is also
 * in charge of starting new "processes" (directives) to respond to various situations. */

import {DirectiveGuard} from './directives/defense/guard';
import {DirectiveBootstrap} from './directives/situational/bootstrap';
import {profile} from './profiler/decorator';
import {Colony, ColonyStage} from './Colony';
import {Overlord} from './overlords/Overlord';
import {Directive} from './directives/Directive';
import {log} from './console/log';
import {Visualizer} from './visuals/Visualizer';
import {Pathing} from './movement/Pathing';
import {DirectiveInvasionDefense} from './directives/defense/invasionDefense';
import {DirectiveNukeResponse} from './directives/situational/nukeResponse';
import {DirectiveTerminalEvacuateState} from './directives/terminalState/terminalState_evacuate';
import {bodyCost} from './creepSetups/CreepSetup';
import {LogisticsNetwork} from './logistics/LogisticsNetwork';
import {Cartographer, ROOMTYPE_CONTROLLER, ROOMTYPE_SOURCEKEEPER} from './utilities/Cartographer';
import {derefCoords, hasJustSpawned, minBy} from './utilities/utils';
import {DirectiveOutpost} from './directives/colony/outpost';
import {Autonomy, getAutonomyLevel} from './memory/Memory';
import {RoomIntel} from './intel/RoomIntel';
import {Roles, Setups} from './creepSetups/setups';
import {USE_TRY_CATCH} from './~settings';


// export const DIRECTIVE_CHECK_FREQUENCY = 2;

@profile
export class Overseer implements IOverseer {

	private overlords: Overlord[];								// Overlords sorted by priority
	private sorted: boolean;
	private overlordsByColony: { [col: string]: Overlord[] };	// Overlords grouped by colony
	private directives: Directive[];							// Directives across the colony

	static settings = {
		outpostCheckFrequency: 250
	};

	constructor() {
		this.directives = [];
		this.overlords = [];
		this.overlordsByColony = {};
		this.sorted = false;
	}

	private try(callback: () => any, identifier?: string): void {
		if (USE_TRY_CATCH) {
			try {
				callback();
			} catch (e) {
				if (identifier) {
					e.name = `Caught unhandled exception at ${'' + callback} (identifier: ${identifier}): \n`
							 + e.name + '\n' + e.stack;
				} else {
					e.name = `Caught unhandled exception at ${'' + callback}: \n` + e.name + '\n' + e.stack;
				}
				Overmind.exceptions.push(e);
			}
		} else {
			callback();
		}
	}

	private get colonies(): Colony[] {
		return _.values(Overmind.colonies);
	}

	registerDirective(directive: Directive): void {
		this.directives.push(directive);
	}

	removeDirective(directive: Directive): void {
		_.remove(this.directives, dir => dir.name == directive.name);
		for (let name in directive.overlords) {
			this.removeOverlord(directive.overlords[name]);
		}
	}

	registerOverlord(overlord: Overlord): void {
		this.overlords.push(overlord);
		if (!this.overlordsByColony[overlord.colony.name]) {
			this.overlordsByColony[overlord.colony.name] = [];
		}
		this.overlordsByColony[overlord.colony.name].push(overlord);
	}

	private removeOverlord(overlord: Overlord): void {
		_.remove(this.overlords, o => o.ref == overlord.ref);
		if (this.overlordsByColony[overlord.colony.name]) {
			_.remove(this.overlordsByColony[overlord.colony.name], o => o.ref == overlord.ref);
		}
	}

	private registerLogisticsRequests(colony: Colony): void {
		// Register logistics requests for all dropped resources and tombstones
		for (let room of colony.rooms) {
			// Pick up all nontrivial dropped resources
			for (let resourceType in room.drops) {
				for (let drop of room.drops[resourceType]) {
					if (drop.amount > LogisticsNetwork.settings.droppedEnergyThreshold
						|| drop.resourceType != RESOURCE_ENERGY) {
						colony.logisticsNetwork.requestOutput(drop);
					}
				}
			}
		}
		// Place a logistics request directive for every tombstone with non-empty store that isn't on a container
		for (let tombstone of colony.tombstones) {
			if (_.sum(tombstone.store) > LogisticsNetwork.settings.droppedEnergyThreshold
				|| _.sum(tombstone.store) > tombstone.store.energy) {
				if (colony.bunker && tombstone.pos.isEqualTo(colony.bunker.anchor)) continue;
				colony.logisticsNetwork.requestOutput(tombstone, {resourceType: 'all'});
			}
		}
	}

	private handleBootstrapping(colony: Colony) {
		// Bootstrap directive: in the event of catastrophic room crash, enter emergency spawn mode.
		// Doesn't apply to incubating colonies.
		if (!colony.isIncubating) {
			let noQueen = colony.getCreepsByRole(Roles.queen).length == 0;
			if (noQueen && colony.hatchery && !colony.spawnGroup) {
				let energyToMakeQueen = bodyCost(Setups.queen.generateBody(colony.room.energyCapacityAvailable));
				if (colony.room.energyAvailable < energyToMakeQueen || hasJustSpawned()) {
					let result = DirectiveBootstrap.createIfNotPresent(colony.hatchery.pos, 'pos');
					if (typeof result == 'string' || result == OK) { // successfully made flag
						colony.hatchery.settings.suppressSpawning = true;
					}
				}
			}
		}
	}

	private handleOutpostGuards(colony: Colony) {
		// Guard directive: defend your outposts and all rooms of colonies that you are incubating
		for (let room of colony.outposts) {
			if (Cartographer.roomType(room.name) != ROOMTYPE_SOURCEKEEPER) { // SK rooms can fend for themselves
				let defenseFlags = _.filter(room.flags, flag => DirectiveGuard.filter(flag) ||
																DirectiveInvasionDefense.filter(flag));
				if (room.dangerousHostiles.length > 0 && defenseFlags.length == 0) {
					DirectiveGuard.create(room.dangerousHostiles[0].pos);
				}
			}
		}
	}

	private handleColonyInvasions(colony: Colony) {
		// Defend against invasions in owned rooms
		if (colony.room && colony.level >= DirectiveInvasionDefense.requiredRCL) {
			let effectiveInvaderCount = _.sum(_.map(colony.room.hostiles,
													invader => invader.boosts.length > 0 ? 2 : 1));
			if (effectiveInvaderCount >= 3 || colony.room.dangerousPlayerHostiles.length > 0) {
				DirectiveInvasionDefense.createIfNotPresent(colony.controller.pos, 'room');
			}
		}
	}

	private handleNukeResponse(colony: Colony) {
		// Place nuke response directive if there is a nuke present in colony room
		if (colony.room && colony.level >= DirectiveNukeResponse.requiredRCL) {
			for (let nuke of colony.room.find(FIND_NUKES)) {
				DirectiveNukeResponse.createIfNotPresent(nuke.pos, 'pos');
			}
		}
	}

	private handleNewOutposts(colony: Colony) {
		let numSources = _.sum(colony.roomNames, roomName => (Memory.rooms[roomName].src || []).length);
		let numRemotes = numSources - colony.room.sources.length;
		if (numRemotes < Colony.settings.remoteSourcesByLevel[colony.level]) {
			// Possible outposts are controller rooms not already reserved or owned
			log.debug(`Calculating colonies for ${colony.room.print}...`);
			log.debug(`Rooms in range 2: ${Cartographer.findRoomsInRange(colony.room.name, 2)}`);
			let possibleOutposts = _.filter(Cartographer.findRoomsInRange(colony.room.name, 2), roomName =>
				Cartographer.roomType(roomName) == ROOMTYPE_CONTROLLER
				&& !_.any(Overmind.cache.outpostFlags,
						  flag => (flag.memory.setPosition || flag.pos).roomName == roomName)
				&& !Overmind.colonies[roomName]
				&& !RoomIntel.roomOwnedBy(roomName)
				&& !RoomIntel.roomReservedBy(roomName)
				&& Game.map.isRoomAvailable(roomName));
			log.debug(`Possible outposts: ${possibleOutposts}`);
			let origin = colony.pos;
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
				log.info(`Colony ${colony.room.print} now remote mining from ${pos.print}`);
				DirectiveOutpost.createIfNotPresent(pos, 'room', {memory: {colony: colony.name}});
			}
		}
	}

	/* Place new event-driven flags where needed to be instantiated on the next tick */
	private placeDirectives(colony: Colony): void {
		this.handleBootstrapping(colony);
		this.handleOutpostGuards(colony);
		this.handleColonyInvasions(colony);
		this.handleNukeResponse(colony);
		if (Game.time % Overseer.settings.outpostCheckFrequency == 2 * colony.id
			&& getAutonomyLevel() > Autonomy.Manual) {
			this.handleNewOutposts(colony);
		}
	}


	// Safe mode condition =============================================================================================

	private handleSafeMode(colony: Colony): void {
		if (colony.stage == ColonyStage.Larva) {
			return;
		}
		// Safe mode activates when there are dangerous player hostiles that can reach the spawn
		let criticalStructures = _.compact([...colony.spawns,
											colony.storage,
											colony.terminal]) as Structure[];
		for (let structure of criticalStructures) {
			if (structure.hits < structure.hitsMax &&
				structure.pos.findInRange(colony.room.dangerousHostiles, 2).length > 0) {
				let ret = colony.controller.activateSafeMode();
				if (ret != OK && !colony.controller.safeMode) {
					if (colony.terminal) {
						DirectiveTerminalEvacuateState.createIfNotPresent(colony.terminal.pos, 'room');
					}
				} else {
					return;
				}
			}
		}
		let firstHostile = _.first(colony.room.dangerousHostiles);
		if (firstHostile && colony.spawns[0]) {
			let barriers = _.map(colony.room.barriers, barrier => barrier.pos);
			if (Pathing.isReachable(firstHostile.pos, colony.spawns[0].pos, barriers)) {
				let ret = colony.controller.activateSafeMode();
				if (ret != OK && !colony.controller.safeMode) {
					if (colony.terminal) {
						DirectiveTerminalEvacuateState.createIfNotPresent(colony.terminal.pos, 'room');
					}
				} else {
					return;
				}
			}
		}
	}

	// Initialization ==================================================================================================

	init(): void {
		// Initialize directives
		for (let directive of this.directives) {
			directive.init();
		}
		// Sort overlords by priority if needed (assumes priority does not change after constructor phase
		if (!this.sorted) {
			this.overlords.sort((o1, o2) => o1.priority - o2.priority);
			this.sorted = true;
		}
		// Initialize overlords
		for (let overlord of this.overlords) {
			overlord.preInit();
			this.try(() => overlord.init());
		}
		// Register cleanup requests to logistics network
		for (let colony of this.colonies) {
			this.registerLogisticsRequests(colony);
		}
	}

	// Operation =======================================================================================================

	run(): void {
		for (let directive of this.directives) {
			directive.run();
		}
		for (let overlord of this.overlords) {
			this.try(() => overlord.run());
		}
		for (let colony of this.colonies) {
			this.handleSafeMode(colony);
			this.placeDirectives(colony);
		}
	}

	private drawCreepReport(colony: Colony) {
		const spoopyBugFix = false;
		let roleOccupancy: { [role: string]: [number, number] } = {};

		for (let overlord of this.overlordsByColony[colony.name]) {
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

		let safeOutposts = _.filter(colony.outposts, room => !!room && room.dangerousHostiles.length == 0);
		let stringReport: string[] = [
			`DEFCON: ${colony.defcon}  Safe outposts: ${safeOutposts.length}/${colony.outposts.length}`,
			`Creep usage for ${colony.name}:`];


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
		const tablePos = new RoomPosition(1, 11.5, colony.room.name);
		Visualizer.infoBox(`${colony.name} Creeps`, roledata, tablePos, 7);
	}

	visuals(): void {
		for (let directive of this.directives) {
			directive.visuals();
		}
		for (let overlord of this.overlords) {
			overlord.visuals();
		}
		for (let colony of this.colonies) {
			this.drawCreepReport(colony);
		}
	}
}
