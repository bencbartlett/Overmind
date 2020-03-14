// Room intel - provides information related to room structure and occupation

import {getAllColonies} from '../Colony';
import {log} from '../console/log';
import {DirectivePowerMine} from '../directives/resource/powerMine';
import {DirectiveStronghold} from '../directives/situational/stronghold';
import {Segmenter} from '../memory/Segmenter';
import {profile} from '../profiler/decorator';
import {ExpansionEvaluator} from '../strategy/ExpansionEvaluator';
import {Cartographer, ROOMTYPE_ALLEY, ROOMTYPE_SOURCEKEEPER} from '../utilities/Cartographer';
import {getCacheExpiration, irregularExponentialMovingAverage} from '../utilities/utils';
import {Zerg} from '../zerg/Zerg';

const RECACHE_TIME = 2500;
const OWNED_RECACHE_TIME = 1000;
const ROOM_CREEP_HISTORY_TICKS = 25;
const SCORE_RECALC_PROB = 0.05;
const FALSE_SCORE_RECALC_PROB = 0.01;

const RoomIntelMemoryDefaults = {};

@profile
export class RoomIntel {

	/**
	 * Mark a room as being visible this tick
	 */
	private static markVisible(room: Room): void {
		room.memory[_MEM.TICK] = Game.time;
	}

	/**
	 * Returns the last tick at which the room was visible, or -100
	 */
	static lastVisible(roomName: string): number {
		if (Memory.rooms[roomName]) {
			return Memory.rooms[roomName][_MEM.TICK] || -100;
		} else {
			return -100;
		}
	}

	/**
	 * Records all info for permanent room objects, e.g. sources, controllers, etc.
	 */
	private static recordPermanentObjects(room: Room): void {
		const savedSources: SavedSource[] = [];
		for (const source of room.sources) {
			const container = source.pos.findClosestByLimitedRange(room.containers, 2);
			savedSources.push({
								  c     : source.pos.coordName,
								  contnr: container ? container.pos.coordName : undefined
							  });
		}
		room.memory[_RM.SOURCES] = savedSources;
		room.memory[_RM.CONTROLLER] = room.controller ? {
			c                            : room.controller.pos.coordName,
			[_RM_CTRL.LEVEL]             : room.controller.level,
			[_RM_CTRL.OWNER]             : room.controller.owner ? room.controller.owner.username : undefined,
			[_RM_CTRL.RESERVATION]       : room.controller.reservation ?
										   {
											   [_RM_CTRL.RES_USERNAME]  : room.controller.reservation.username,
											   [_RM_CTRL.RES_TICKSTOEND]: room.controller.reservation.ticksToEnd,
										   } : undefined,
			[_RM_CTRL.SAFEMODE]          : room.controller.safeMode,
			[_RM_CTRL.SAFEMODE_AVAILABLE]: room.controller.safeModeAvailable,
			[_RM_CTRL.SAFEMODE_COOLDOWN] : room.controller.safeModeCooldown,
			[_RM_CTRL.PROGRESS]          : room.controller.progress,
			[_RM_CTRL.PROGRESS_TOTAL]    : room.controller.progressTotal
		} : undefined;
		room.memory[_RM.MINERAL] = room.mineral ? {
			c                     : room.mineral.pos.coordName,
			[_RM_MNRL.DENSITY]    : room.mineral.density,
			[_RM_MNRL.MINERALTYPE]: room.mineral.mineralType
		} : undefined;
		room.memory[_RM.SKLAIRS] = _.map(room.keeperLairs, lair => {
			return {c: lair.pos.coordName};
		});
		room.memory[_RM.PORTALS] = _.map(room.portals, portal => {
			const dest = portal.destination instanceof RoomPosition ? portal.destination.name
																	: portal.destination;
			const expiration = portal.ticksToDecay != undefined ? Game.time + portal.ticksToDecay : Game.time + 1e6;
			return {c: portal.pos.coordName, dest: dest, [_MEM.EXPIRATION]: expiration};
		});
		if (room.controller && room.controller.owner) {
			room.memory[_RM.IMPORTANT_STRUCTURES] = {
				[_RM_IS.TOWERS]  : _.map(room.towers, t => t.pos.coordName),
				[_RM_IS.SPAWNS]  : _.map(room.spawns, s => s.pos.coordName),
				[_RM_IS.STORAGE] : room.storage ? room.storage.pos.coordName : undefined,
				[_RM_IS.TERMINAL]: room.terminal ? room.terminal.pos.coordName : undefined,
				[_RM_IS.WALLS]   : _.map(room.walls, w => w.pos.coordName),
				[_RM_IS.RAMPARTS]: _.map(room.ramparts, r => r.pos.coordName),
			};
		} else {
			room.memory[_RM.IMPORTANT_STRUCTURES] = undefined;
		}
		room.memory[_MEM.TICK] = Game.time;
	}

	/**
	 * Update time-sensitive reservation and safemode info
	 */
	private static recordControllerInfo(controller: StructureController): void {
		const savedController = controller.room.memory[_RM.CONTROLLER];
		if (savedController) {
			savedController[_RM_CTRL.RESERVATION] = controller.reservation ? {
				[_RM_CTRL.RES_USERNAME]  : controller.reservation.username,
				[_RM_CTRL.RES_TICKSTOEND]: controller.reservation.ticksToEnd,
			} : undefined;
			savedController[_RM_CTRL.SAFEMODE] = controller.safeMode;
			savedController[_RM_CTRL.SAFEMODE_COOLDOWN] = controller.safeModeCooldown;
		}
	}

	static inSafeMode(roomName: string): boolean {
		if (!!Memory.rooms[roomName] && !!Memory.rooms[roomName][_RM.CONTROLLER]) {
			const safemode = Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.SAFEMODE];
			const tick = Memory.rooms[roomName][_MEM.EXPIRATION];
			if (safemode && tick) {
				return Game.time < tick + safemode;
			}
		}
		return false;
	}

	static safeModeCooldown(roomName: string): number | undefined {
		if (Memory.rooms[roomName] && Memory.rooms[roomName][_RM.CONTROLLER] &&
			Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.SAFEMODE_COOLDOWN]) {
			const smcooldown = Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.SAFEMODE_COOLDOWN];
			const tick = Memory.rooms[roomName][_MEM.EXPIRATION];
			if (smcooldown && tick) {
				return smcooldown - (Game.time - tick);
			}
		}
	}

	private static recomputeScoreIfNecessary(room: Room): boolean {
		if (room.memory[_RM.EXPANSION_DATA] == false) { // room is uninhabitable or owned
			if (Math.random() < FALSE_SCORE_RECALC_PROB) {
				// false scores get evaluated very occasionally
				return ExpansionEvaluator.computeExpansionData(room);
			}
		} else { // if the room is not uninhabitable
			if (!room.memory[_RM.EXPANSION_DATA] || Math.random() < SCORE_RECALC_PROB) {
				// recompute some of the time
				return ExpansionEvaluator.computeExpansionData(room);
			}
		}
		return false;
	}

	private static updateInvasionData(room: Room): void {
		if (!room.memory[_RM.INVASION_DATA]) {
			room.memory[_RM.INVASION_DATA] = {
				[_RM_INVASION.HARVESTED]: 0,
				[_RM_INVASION.LAST_SEEN]: 0,
			};
		}
		const sources = room.sources;
		const invasionData = room.memory[_RM.INVASION_DATA]!;
		for (const source of sources) {
			if (source.ticksToRegeneration == 1) {
				invasionData[_RM_INVASION.HARVESTED] += source.energyCapacity - source.energy;
			}
		}
		if (room.invaders.length > 0) {
			invasionData[_RM_INVASION.HARVESTED] = 0;
			invasionData[_RM_INVASION.LAST_SEEN] = Game.time;
		}
	}

	// private static updateHarvestData(room: Room): void {
	// 	if (!room.memory[_RM.HARVEST]) {
	// 		room.memory[_RM.HARVEST] = {
	// 			[_ROLLING_STATS.AMOUNT] : 0,
	// 			[_ROLLING_STATS.AVG10K] : _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
	// 			[_ROLLING_STATS.AVG100K]: _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
	// 			[_ROLLING_STATS.AVG1M]  : _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
	// 			[_MEM.TICK]             : Game.time,
	// 		};
	// 	}
	// 	const harvest = room.memory[_RM.HARVEST] as RollingStats;
	// 	for (const source of room.sources) { // TODO: this implicitly assumes all energy is harvested by me
	// 		if (source.ticksToRegeneration == 1) {
	// 			const dEnergy = source.energyCapacity - source.energy;
	// 			const dTime = Game.time - harvest[_MEM.TICK] + 1; // +1 to avoid division by zero errors
	// 			harvest[_ROLLING_STATS.AMOUNT] += dEnergy;
	// 			harvest[_ROLLING_STATS.AVG10K] = +(irregularExponentialMovingAverage(
	// 				dEnergy / dTime, harvest[_ROLLING_STATS.AVG10K], dTime, 10000)).toFixed(7);
	// 			harvest[_ROLLING_STATS.AVG100K] = +(irregularExponentialMovingAverage(
	// 				dEnergy / dTime, harvest[_ROLLING_STATS.AVG100K], dTime, 100000)).toFixed(7);
	// 			harvest[_ROLLING_STATS.AVG1M] = +(irregularExponentialMovingAverage(
	// 				dEnergy / dTime, harvest[_ROLLING_STATS.AVG1M], dTime, 1000000)).toFixed(7);
	// 			harvest[_MEM.TICK] = Game.time;
	// 		}
	// 	}
	// }

	// private static updateCasualtyData(room: Room): void {
	// 	if (!room.memory[_RM.CASUALTIES]) {
	// 		room.memory[_RM.CASUALTIES] = {
	// 			cost: {
	// 				[_ROLLING_STATS.AMOUNT] : 0,
	// 				[_ROLLING_STATS.AVG10K] : 0,
	// 				[_ROLLING_STATS.AVG100K]: 0,
	// 				[_ROLLING_STATS.AVG1M]  : 0,
	// 				[_MEM.TICK]             : Game.time,
	// 			}
	// 		};
	// 	}
	// 	const casualtiesCost = room.memory[_RM.CASUALTIES]!.cost as RollingStats;
	// 	for (const tombstone of room.tombstones) {
	// 		if (tombstone.ticksToDecay == 1) {
	// 			// record any casualties, which are my creeps which died prematurely
	// 			if ((tombstone.creep.ticksToLive || 0) > 1 && tombstone.creep.owner.username == MY_USERNAME
	// 				&& isCreep(tombstone.creep)) {
	// 				const body = _.map(tombstone.creep.body, part => part.type);
	// 				const lifetime = body.includes(CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
	// 				const dCost = bodyCost(body) * (tombstone.creep.ticksToLive || 0) / lifetime;
	// 				const dTime = Game.time - casualtiesCost[_MEM.TICK] + 1;
	// 				casualtiesCost[_ROLLING_STATS.AMOUNT] += dCost;
	// 				casualtiesCost[_ROLLING_STATS.AVG10K] = +(irregularExponentialMovingAverage(
	// 					dCost / dTime, casualtiesCost[_ROLLING_STATS.AVG10K], dTime, 10000)).toFixed(7);
	// 				casualtiesCost[_ROLLING_STATS.AVG100K] = +(irregularExponentialMovingAverage(
	// 					dCost / dTime, casualtiesCost[_ROLLING_STATS.AVG100K], dTime, 100000)).toFixed(7);
	// 				casualtiesCost[_ROLLING_STATS.AVG1M] = +(irregularExponentialMovingAverage(
	// 					dCost / dTime, casualtiesCost[_ROLLING_STATS.AVG1M], dTime, 1000000)).toFixed(7);
	// 				casualtiesCost[_MEM.TICK] = Game.time;
	// 			}
	// 		}
	// 	}
	// }

	/**
	 * Get the pos a creep was in on the previous tick
	 */
	static getPreviousPos(creep: Creep | Zerg): RoomPosition {
		if (creep.room.memory[_RM.PREV_POSITIONS] && creep.room.memory[_RM.PREV_POSITIONS]![creep.id.toString()]) {
			return derefRoomPosition(creep.room.memory[_RM.PREV_POSITIONS]![creep.id.toString()]);
		} else {
			return creep.pos; // no data
		}
	}

	private static recordCreepPositions(room: Room): void {
		room.memory[_RM.PREV_POSITIONS] = {};
		for (const creep of room.find(FIND_CREEPS)) {
			room.memory[_RM.PREV_POSITIONS]![creep.id.toString()] = creep.pos;
		}
	}

	private static recordCreepOccupancies(room: Room): void {
		if (!room.memory[_RM.CREEPS_IN_ROOM]) {
			room.memory[_RM.CREEPS_IN_ROOM] = {};
		}
		const creepsInRoom = room.memory[_RM.CREEPS_IN_ROOM]!;
		for (const tick in creepsInRoom) {
			if (parseInt(tick, 10) < Game.time - ROOM_CREEP_HISTORY_TICKS) {
				delete creepsInRoom[tick];
			}
		}
		creepsInRoom[Game.time] = _.map(room.hostiles, creep => creep.name);
	}

	private static recordSafety(room: Room): void {
		if (!room.memory[_RM.SAFETY]) {
			room.memory[_RM.SAFETY] = {
				[_RM_SAFETY.SAFE_FOR]  : 0,
				[_RM_SAFETY.UNSAFE_FOR]: 0,
				[_RM_SAFETY.SAFETY_1K] : 1,
				[_RM_SAFETY.SAFETY_10K]: 1,
				[_RM_SAFETY.TICK]      : Game.time
			};
		}
		let safety: number;
		const safetyData = room.memory[_RM.SAFETY] as SafetyData;
		if (room.dangerousHostiles.length > 0) {
			safetyData[_RM_SAFETY.SAFE_FOR]  = 0;
			safetyData[_RM_SAFETY.UNSAFE_FOR] += 1;
			safety = 0;
		} else {
			safetyData[_RM_SAFETY.SAFE_FOR]  += 1;
			safetyData[_RM_SAFETY.UNSAFE_FOR] = 0;
			safety = 1;
		}
		// Compute rolling averages
		const dTime = Game.time - safetyData[_RM_SAFETY.TICK];
		safetyData[_RM_SAFETY.SAFETY_1K] = +(irregularExponentialMovingAverage(
			safety, safetyData[_RM_SAFETY.SAFETY_1K], dTime, 1000)).toFixed(5);
		safetyData[_RM_SAFETY.SAFETY_10K] = +(irregularExponentialMovingAverage(
			safety, safetyData[_RM_SAFETY.SAFETY_10K], dTime, 10000)).toFixed(5);
		safetyData[_RM_SAFETY.TICK] = Game.time;
	}

	static getSafetyData(roomName: string): SafetyData {
		if (!Memory.rooms[roomName]) {
			Memory.rooms[roomName] = {};
		}
		if (!Memory.rooms[roomName][_RM.SAFETY]) {
			Memory.rooms[roomName][_RM.SAFETY] = {
				[_RM_SAFETY.SAFE_FOR]  : 0,
				[_RM_SAFETY.UNSAFE_FOR]: 0,
				[_RM_SAFETY.SAFETY_1K] : 1,
				[_RM_SAFETY.SAFETY_10K]: 1,
				[_RM_SAFETY.TICK]      : Game.time
			};
		}
		return Memory.rooms[roomName][_RM.SAFETY]!;
	}

	static isInvasionLikely(room: Room): boolean {
		const data = room.memory[_RM.INVASION_DATA];
		if (!data) return false;
		const harvested = data[_RM_INVASION.HARVESTED];
		const lastSeen = data[_RM_INVASION.LAST_SEEN];
		if (lastSeen > 20000) { // maybe room is surrounded by owned/reserved rooms and invasions aren't possible
			return false;
		}
		switch (room.sources.length) {
			case 1:
				return harvested > 90000;
			case 2:
				return harvested > 75000;
			case 3:
				return harvested > 65000;
			default: // shouldn't ever get here
				return false;
		}
	}

	static roomOwnedBy(roomName: string): string | undefined {
		if (Memory.rooms[roomName] && Memory.rooms[roomName][_RM.CONTROLLER] &&
			Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.OWNER]) {
			if (Game.time - (Memory.rooms[roomName][_MEM.TICK] || 0) < 25000) { // ownership expires after 25k ticks
				return Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.OWNER];
			}
		}
	}

	static roomReservedBy(roomName: string): string | undefined {
		if (Memory.rooms[roomName] && Memory.rooms[roomName][_RM.CONTROLLER] &&
			Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.RESERVATION]) {
			if (Game.time - (Memory.rooms[roomName][_MEM.TICK] || 0) < 10000) { // reservation expires after 10k ticks
				return Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.RESERVATION]![_RM_CTRL.RES_USERNAME];
			}
		}
	}

	static roomReservationRemaining(roomName: string): number {
		if (Memory.rooms[roomName] && Memory.rooms[roomName][_RM.CONTROLLER] &&
			Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.RESERVATION]) {
			const ticksToEnd = Memory.rooms[roomName][_RM.CONTROLLER]![_RM_CTRL.RESERVATION]![_RM_CTRL.RES_TICKSTOEND];
			const timeSinceLastSeen = Game.time - (Memory.rooms[roomName][_MEM.TICK] || 0);
			return ticksToEnd - timeSinceLastSeen;
		}
		return 0;
	}

	/**
	 * Find PowerBanks within range of maxRange and power above minPower to mine
	 * Creates directive to mine it
	 * TODO refactor when factory resources come out to be more generic
	 * TODO move to strategist for opportunistic directives
	 */
	private static minePowerBanks(room: Room) {
		const powerSetting = Memory.settings.powerCollection;
		if (powerSetting.enabled && Cartographer.roomType(room.name) == ROOMTYPE_ALLEY) {
			const powerBank = _.first(room.find(FIND_STRUCTURES)
										  .filter(struct => struct.structureType == STRUCTURE_POWER_BANK)) as StructurePowerBank;
			if (powerBank != undefined && powerBank.ticksToDecay > 4000 && powerBank.power >= powerSetting.minPower) {
				// Game.notify(`Looking for power banks in ${room}  found
				// ${powerBank} with power ${powerBank.power} and ${powerBank.ticksToDecay} TTL.`);
				if (DirectivePowerMine.isPresent(powerBank.pos, 'pos')) {
					// Game.notify(`Already mining room ${powerBank.room}!`);
					return;
				}

				const colonies = getAllColonies().filter(colony => colony.level > 6
					&& Game.map.getRoomLinearDistance(colony.name, powerBank.room.name) > powerSetting.maxRange);
				for (const colony of colonies) {
					const route = Game.map.findRoute(colony.room, powerBank.room);
					if (route != -2 && route.length <= powerSetting.maxRange) {
						log.info(`FOUND POWER BANK IN RANGE ${route.length}, STARTING MINING ${powerBank.room}`);
						DirectivePowerMine.create(powerBank.pos);
						return;
					}
				}

			}
		}
	}

	/**
	 * Handle strongholds spawning in SK rooms
	 * Should also eventually loot other people's strongholds that are killed
	 * TODO move to strategist
	 * @param room
	 */
	private static handleStrongholds(room: Room) {
		if (room && Cartographer.roomType(room.name) == ROOMTYPE_SOURCEKEEPER && !!room.invaderCore) {
			const core = room.invaderCore;
			if (DirectiveStronghold.isPresent(core.pos, 'pos')) {
				return;
			}

			const colonies = getAllColonies().filter(colony => colony.level == 8
				&& Game.map.getRoomLinearDistance(colony.name, core.room.name) < 5);
			for (const colony of colonies) {
				const route = Game.map.findRoute(colony.room, core.room);
				if (route != -2  && route.length <= 4) {
					Game.notify(`FOUND STRONGHOLD ${core.level} AT DISTANCE ${route.length}, BEGINNING ATTACK ${core.room}`);
					DirectiveStronghold.createIfNotPresent(core.pos, 'pos');
					return;
				}
			}
		}
	}

	static requestZoneData() {
		const checkOnTick = 123;
		if (Game.time % 1000 == checkOnTick - 2) {
			Segmenter.requestForeignSegment('LeagueOfAutomatedNations', 96);
		} else if (Game.time % 1000 == checkOnTick - 1) {
			const loanData = Segmenter.getForeignSegment();
			if (loanData) {
				Memory.zoneRooms = loanData;
			} else {
				log.error('Empty LOAN data');
			}
		}
	}

	// TODO FIXME XXX necessary evil for now since memory is overloaded
	static cleanRoomMemory() {
		for (const roomName in Memory.rooms) {
			if (Cartographer.roomType(roomName) == 'ALLEY' || roomName.indexOf('E') != -1 || roomName.indexOf('S') != -1) {
				delete Memory.rooms[roomName];
				console.log(roomName);
			}
		}

		const roomsToDelete = [];
		let x = 0;
		for (const roomName in Memory.rooms) {
			let remove = true;
			for (const colonyName in Memory.colonies) {
				if (Game.map.getRoomLinearDistance(roomName, colonyName) <= 2) {
					remove = false;
				}
			}
			if (remove && roomsToDelete.indexOf(roomName) == -1) {
				x++;
				roomsToDelete.push(roomName);
				console.log(x + ') ' + roomName);
				delete Memory.rooms[roomName];
			}
		}
	}

	static run(): void {
		let alreadyComputedScore = false;
		// this.requestZoneData();
		// If above 2030 kb wipe memory down
		if (Game.time % 375 == 0 || RawMemory.get().length > 2040000) {
			RoomIntel.cleanRoomMemory();
		}

		for (const name in Game.rooms) {

			const room: Room = Game.rooms[name];

			this.markVisible(room);
			this.recordSafety(room);

			// Track invasion data, harvesting, and casualties for all colony rooms and outposts
			if (Overmind.colonyMap[room.name]) { // if it is an owned or outpost room
				this.updateInvasionData(room);
				// this.updateHarvestData(room);
				// this.updateCasualtyData(room);
			}

			// Record previous creep positions (RoomIntel.run() is executed at end of each tick)
			this.recordCreepPositions(room);
			if (room.my) {
				this.recordCreepOccupancies(room);
			}

			// Record location of permanent objects in room and recompute score as needed
			if (Game.time >= (room.memory[_MEM.EXPIRATION] || 0) && Cartographer.roomType(name) != 'ALLEY') {
				this.recordPermanentObjects(room);
				if (!alreadyComputedScore) {
					alreadyComputedScore = this.recomputeScoreIfNecessary(room);
				}
				// Refresh cache
				const recacheTime = room.owner ? OWNED_RECACHE_TIME : RECACHE_TIME;
				room.memory[_MEM.EXPIRATION] = getCacheExpiration(recacheTime, 250);
			}

			if (room.controller && Game.time % 5 == 0) {
				this.recordControllerInfo(room.controller);
			}
			this.minePowerBanks(room);
			this.handleStrongholds(room);
		}
	}

}

// For debugging purposes
global.RoomIntel = RoomIntel;

