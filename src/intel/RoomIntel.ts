// Room intel - provides information related to room structure and occupation

import {log} from '../console/log';
import {Segmenter} from '../memory/Segmenter';
import {profile} from '../profiler/decorator';
import {ExpansionEvaluator} from '../strategy/ExpansionEvaluator';
import {Cartographer, ROOMTYPE_CORE, ROOMTYPE_CROSSROAD} from '../utilities/Cartographer';
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
		room.memory[MEM.TICK] = Game.time;
	}

	/**
	 * Returns the last tick at which the room was visible, or -100
	 */
	static lastVisible(roomName: string): number {
		if (Memory.rooms[roomName]) {
			return Memory.rooms[roomName][MEM.TICK] || -100;
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
		room.memory[RMEM.SOURCES] = savedSources;
		room.memory[RMEM.CONTROLLER] = room.controller ? {
			c                             : room.controller.pos.coordName,
			[RMEM_CTRL.LEVEL]             : room.controller.level,
			[RMEM_CTRL.OWNER]             : room.controller.owner ? room.controller.owner.username : undefined,
			[RMEM_CTRL.RESERVATION]       : room.controller.reservation ?
											{
												[RMEM_CTRL.RES_USERNAME]  : room.controller.reservation.username,
												[RMEM_CTRL.RES_TICKSTOEND]: room.controller.reservation.ticksToEnd,
											} : undefined,
			[RMEM_CTRL.SAFEMODE]          : room.controller.safeMode,
			[RMEM_CTRL.SAFEMODE_AVAILABLE]: room.controller.safeModeAvailable,
			[RMEM_CTRL.SAFEMODE_COOLDOWN] : room.controller.safeModeCooldown,
			[RMEM_CTRL.PROGRESS]          : room.controller.progress,
			[RMEM_CTRL.PROGRESS_TOTAL]    : room.controller.progressTotal
		} : undefined;
		room.memory[RMEM.MINERAL] = room.mineral ? {
			c                      : room.mineral.pos.coordName,
			[RMEM_MNRL.DENSITY]    : room.mineral.density,
			[RMEM_MNRL.MINERALTYPE]: room.mineral.mineralType
		} : undefined;
		room.memory[RMEM.SKLAIRS] = _.map(room.keeperLairs, lair => {
			return {c: lair.pos.coordName};
		});
		room.memory[RMEM.PORTALS] = _.map(room.portals, portal => {
			const dest = portal.destination instanceof RoomPosition ? portal.destination.name
																	: portal.destination;
			const expiration = portal.ticksToDecay != undefined ? Game.time + portal.ticksToDecay : Game.time + 1e6;
			return {c: portal.pos.coordName, dest: dest, [MEM.EXPIRATION]: expiration};
		});
		if (room.controller && room.controller.owner) {
			room.memory[RMEM.IMPORTANT_STRUCTURES] = {
				[RMEM_STRUCTS.TOWERS]  : _.map(room.towers, t => t.pos.coordName),
				[RMEM_STRUCTS.SPAWNS]  : _.map(room.spawns, s => s.pos.coordName),
				[RMEM_STRUCTS.STORAGE] : room.storage ? room.storage.pos.coordName : undefined,
				[RMEM_STRUCTS.TERMINAL]: room.terminal ? room.terminal.pos.coordName : undefined,
				[RMEM_STRUCTS.WALLS]   : _.map(room.walls, w => w.pos.coordName),
				[RMEM_STRUCTS.RAMPARTS]: _.map(room.ramparts, r => r.pos.coordName),
			};
		} else {
			room.memory[RMEM.IMPORTANT_STRUCTURES] = undefined;
		}
		room.memory[MEM.TICK] = Game.time;
	}

	/**
	 * Update time-sensitive reservation and safemode info
	 */
	private static recordControllerInfo(controller: StructureController): void {
		const savedController = controller.room.memory[RMEM.CONTROLLER];
		if (savedController) {
			savedController[RMEM_CTRL.RESERVATION] = controller.reservation ? {
				[RMEM_CTRL.RES_USERNAME]  : controller.reservation.username,
				[RMEM_CTRL.RES_TICKSTOEND]: controller.reservation.ticksToEnd,
			} : undefined;
			savedController[RMEM_CTRL.SAFEMODE] = controller.safeMode;
			savedController[RMEM_CTRL.SAFEMODE_COOLDOWN] = controller.safeModeCooldown;
		}
	}

	static inSafeMode(roomName: string): boolean {
		if (!!Memory.rooms[roomName] && !!Memory.rooms[roomName][RMEM.CONTROLLER]) {
			const safemode = Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.SAFEMODE];
			const tick = Memory.rooms[roomName][MEM.EXPIRATION];
			if (safemode && tick) {
				return Game.time < tick + safemode;
			}
		}
		return false;
	}

	static safeModeCooldown(roomName: string): number | undefined {
		if (Memory.rooms[roomName] && Memory.rooms[roomName][RMEM.CONTROLLER] &&
			Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.SAFEMODE_COOLDOWN]) {
			const smcooldown = Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.SAFEMODE_COOLDOWN];
			const tick = Memory.rooms[roomName][MEM.EXPIRATION];
			if (smcooldown && tick) {
				return smcooldown - (Game.time - tick);
			}
		}
	}

	private static recomputeScoreIfNecessary(room: Room): boolean {
		if (room.memory[RMEM.EXPANSION_DATA] == false) { // room is uninhabitable or owned
			if (Math.random() < FALSE_SCORE_RECALC_PROB) {
				// false scores get evaluated very occasionally
				return ExpansionEvaluator.computeExpansionData(room);
			}
		} else { // if the room is not uninhabitable
			if (!room.memory[RMEM.EXPANSION_DATA] || Math.random() < SCORE_RECALC_PROB) {
				// recompute some of the time
				return ExpansionEvaluator.computeExpansionData(room);
			}
		}
		return false;
	}

	private static updateInvasionData(room: Room): void {
		if (!room.memory[RMEM.INVASION_DATA]) {
			room.memory[RMEM.INVASION_DATA] = {
				[RMEM_INVASION.HARVESTED]: 0,
				[RMEM_INVASION.LAST_SEEN]: 0,
			};
		}
		const sources = room.sources;
		const invasionData = room.memory[RMEM.INVASION_DATA]!;
		for (const source of sources) {
			if (source.ticksToRegeneration == 1) {
				invasionData[RMEM_INVASION.HARVESTED] += source.energyCapacity - source.energy;
			}
		}
		if (room.invaders.length > 0) {
			invasionData[RMEM_INVASION.HARVESTED] = 0;
			invasionData[RMEM_INVASION.LAST_SEEN] = Game.time;
		}
	}

	// private static updateHarvestData(room: Room): void {
	// 	if (!room.memory[RMEM.HARVEST]) {
	// 		room.memory[RMEM.HARVEST] = {
	// 			[MEM_AVGS.AMOUNT] : 0,
	// 			[MEM_AVGS.AVG10K] : _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
	// 			[MEM_AVGS.AVG100K]: _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
	// 			[MEM_AVGS.AVG1M]  : _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
	// 			[MEM.TICK]             : Game.time,
	// 		};
	// 	}
	// 	const harvest = room.memory[RMEM.HARVEST] as RollingStats;
	// 	for (const source of room.sources) {
	// 		if (source.ticksToRegeneration == 1) {
	// 			const dEnergy = source.energyCapacity - source.energy;
	// 			const dTime = Game.time - harvest[MEM.TICK] + 1; // +1 to avoid division by zero errors
	// 			harvest[MEM_AVGS.AMOUNT] += dEnergy;
	// 			harvest[MEM_AVGS.AVG10K] = +(irregularExponentialMovingAverage(
	// 				dEnergy / dTime, harvest[MEM_AVGS.AVG10K], dTime, 10000)).toFixed(7);
	// 			harvest[MEM_AVGS.AVG100K] = +(irregularExponentialMovingAverage(
	// 				dEnergy / dTime, harvest[MEM_AVGS.AVG100K], dTime, 100000)).toFixed(7);
	// 			harvest[MEM_AVGS.AVG1M] = +(irregularExponentialMovingAverage(
	// 				dEnergy / dTime, harvest[MEM_AVGS.AVG1M], dTime, 1000000)).toFixed(7);
	// 			harvest[MEM.TICK] = Game.time;
	// 		}
	// 	}
	// }

	// private static updateCasualtyData(room: Room): void {
	// 	if (!room.memory[RMEM.CASUALTIES]) {
	// 		room.memory[RMEM.CASUALTIES] = {
	// 			cost: {
	// 				[MEM_AVGS.AMOUNT] : 0,
	// 				[MEM_AVGS.AVG10K] : 0,
	// 				[MEM_AVGS.AVG100K]: 0,
	// 				[MEM_AVGS.AVG1M]  : 0,
	// 				[MEM.TICK]             : Game.time,
	// 			}
	// 		};
	// 	}
	// 	const casualtiesCost = room.memory[RMEM.CASUALTIES]!.cost as RollingStats;
	// 	for (const tombstone of room.tombstones) {
	// 		if (tombstone.ticksToDecay == 1) {
	// 			// record any casualties, which are my creeps which died prematurely
	// 			if ((tombstone.creep.ticksToLive || 0) > 1 && tombstone.creep.owner.username == MY_USERNAME
	// 				&& isCreep(tombstone.creep)) {
	// 				const body = _.map(tombstone.creep.body, part => part.type);
	// 				const lifetime = body.includes(CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
	// 				const dCost = bodyCost(body) * (tombstone.creep.ticksToLive || 0) / lifetime;
	// 				const dTime = Game.time - casualtiesCost[MEM.TICK] + 1;
	// 				casualtiesCost[MEM_AVGS.AMOUNT] += dCost;
	// 				casualtiesCost[MEM_AVGS.AVG10K] = +(irregularExponentialMovingAverage(
	// 					dCost / dTime, casualtiesCost[MEM_AVGS.AVG10K], dTime, 10000)).toFixed(7);
	// 				casualtiesCost[MEM_AVGS.AVG100K] = +(irregularExponentialMovingAverage(
	// 					dCost / dTime, casualtiesCost[MEM_AVGS.AVG100K], dTime, 100000)).toFixed(7);
	// 				casualtiesCost[MEM_AVGS.AVG1M] = +(irregularExponentialMovingAverage(
	// 					dCost / dTime, casualtiesCost[MEM_AVGS.AVG1M], dTime, 1000000)).toFixed(7);
	// 				casualtiesCost[MEM.TICK] = Game.time;
	// 			}
	// 		}
	// 	}
	// }

	/**
	 * Get the pos a creep was in on the previous tick
	 */
	static getPreviousPos(creep: Creep | Zerg): RoomPosition {
		if (creep.room.memory[RMEM.PREV_POSITIONS] && creep.room.memory[RMEM.PREV_POSITIONS]![creep.id]) {
			return derefRoomPosition(creep.room.memory[RMEM.PREV_POSITIONS]![creep.id]);
		} else {
			return creep.pos; // no data
		}
	}

	private static recordCreepPositions(room: Room): void {
		room.memory[RMEM.PREV_POSITIONS] = {};
		for (const creep of room.find(FIND_CREEPS)) {
			room.memory[RMEM.PREV_POSITIONS]![creep.id] = creep.pos;
		}
	}

	private static recordCreepOccupancies(room: Room): void {
		if (!room.memory[RMEM.CREEPS_IN_ROOM]) {
			room.memory[RMEM.CREEPS_IN_ROOM] = {};
		}
		const creepsInRoom = room.memory[RMEM.CREEPS_IN_ROOM]!;
		for (const tick in creepsInRoom) {
			if (parseInt(tick, 10) < Game.time - ROOM_CREEP_HISTORY_TICKS) {
				delete creepsInRoom[tick];
			}
		}
		creepsInRoom[Game.time] = _.map(room.hostiles, creep => creep.name);
	}

	private static recordSafety(room: Room): void {
		if (!room.memory[RMEM.SAFETY]) {
			room.memory[RMEM.SAFETY] = {
				[_RM_SAFETY.SAFE_FOR]  : 0,
				[_RM_SAFETY.UNSAFE_FOR]: 0,
				[_RM_SAFETY.SAFETY_1K] : 1,
				[_RM_SAFETY.SAFETY_10K]: 1,
				[_RM_SAFETY.TICK]      : Game.time
			};
		}
		let safety: number;
		const safetyData = room.memory[RMEM.SAFETY] as SafetyData;
		if (room.dangerousHostiles.length > 0) {
			safetyData[_RM_SAFETY.SAFE_FOR] = 0;
			safetyData[_RM_SAFETY.UNSAFE_FOR] += 1;
			safety = 0;
		} else {
			safetyData[_RM_SAFETY.SAFE_FOR] += 1;
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
		if (!Memory.rooms[roomName][RMEM.SAFETY]) {
			Memory.rooms[roomName][RMEM.SAFETY] = {
				[_RM_SAFETY.SAFE_FOR]  : 0,
				[_RM_SAFETY.UNSAFE_FOR]: 0,
				[_RM_SAFETY.SAFETY_1K] : 1,
				[_RM_SAFETY.SAFETY_10K]: 1,
				[_RM_SAFETY.TICK]      : Game.time
			};
		}
		return Memory.rooms[roomName][RMEM.SAFETY]!;
	}

	static isInvasionLikely(room: Room): boolean {
		const data = room.memory[RMEM.INVASION_DATA];
		if (!data) return false;
		const harvested = data[RMEM_INVASION.HARVESTED];
		const lastSeen = data[RMEM_INVASION.LAST_SEEN];
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
		if (Memory.rooms[roomName] && Memory.rooms[roomName][RMEM.CONTROLLER] &&
			Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.OWNER]) {
			if (Game.time - (Memory.rooms[roomName][MEM.TICK] || 0) < 25000) { // ownership expires after 25k ticks
				return Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.OWNER];
			}
		}
	}

	static roomReservedBy(roomName: string): string | undefined {
		if (Memory.rooms[roomName] && Memory.rooms[roomName][RMEM.CONTROLLER] &&
			Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.RESERVATION]) {
			if (Game.time - (Memory.rooms[roomName][MEM.TICK] || 0) < 10000) { // reservation expires after 10k ticks
				return Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.RESERVATION]![RMEM_CTRL.RES_USERNAME];
			}
		}
	}

	static roomReservationRemaining(roomName: string): number {
		if (Memory.rooms[roomName] && Memory.rooms[roomName][RMEM.CONTROLLER] &&
			Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.RESERVATION]) {
			const ticksToEnd = Memory.rooms[roomName][RMEM.CONTROLLER]![RMEM_CTRL.RESERVATION]![RMEM_CTRL.RES_TICKSTOEND];
			const timeSinceLastSeen = Game.time - (Memory.rooms[roomName][MEM.TICK] || 0);
			return ticksToEnd - timeSinceLastSeen;
		}
		return 0;
	}

	private static scoutPortals(room: Room) {
		if (Cartographer.roomType(room.name) == ROOMTYPE_CROSSROAD || Cartographer.roomType(room.name) == ROOMTYPE_CORE) {
			if (room.portals) {
				// Store the portals
			}
		}
	}

	/**
	 * Returns the portals that are within a specified range of a colony indexed by their room
	 */
	static findPortalsInRange(roomName: string, range: number): { [roomName: string]: SavedPortal[] } {
		// TODO won't take into account intershard CROSSROAD rooms for simplicity sake, fix later
		const potentialPortalRooms = Cartographer.findRoomsInRange(roomName, range)
												 .filter(roomName => Cartographer.roomType(roomName) == ROOMTYPE_CORE);
		// Examine for portals
		const portalRooms = potentialPortalRooms.filter(roomName => Memory.rooms[roomName]
																	&& !!Memory.rooms[roomName][RMEM.PORTALS]);
		const rooms: { [name: string]: SavedPortal[]; } = {};
		for (const roomName of portalRooms) {
			const roomPortals = Memory.rooms[roomName][RMEM.PORTALS]; // to prevent TS errors
			if (roomPortals != undefined && roomPortals.length > 0) {
				rooms[roomName] = roomPortals;
			}
		}
		return rooms;
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

	/**
	 * Cached version of Game.map.getRoomStatus() which retrieves compressed status data and converts to RoomStatus
	 */
	static getRoomStatus(roomName: string): RoomStatus {
		Memory.rooms[roomName] = Memory.rooms[roomName] || {};
		// Recalculate if you haven't seen this room before or if the timestamp is expired
		if (!Memory.rooms[roomName][RMEM.ROOM_STATUS] ||
			new Date().getTime() > new Date(Memory.rooms[roomName][RMEM.ROOM_STATUS]![1] * 1000).getTime()) {
			let {status, timestamp} = Game.map.getRoomStatus(roomName);
			if (timestamp == null) { // null timestamp means indefinite, but not really; let's recheck in a few days
				const extraMilliseconds = 3 * 24 * 60 * 60 * 1000; // check again in 3 days
				timestamp = new Date().getTime() + extraMilliseconds;
			}
			timestamp = Math.floor(timestamp / 1000); // don't need milliseconds; seconds will do
			switch (status) {
				case 'normal':
					Memory.rooms[roomName][RMEM.ROOM_STATUS] = [RMEM_ROOM_STATUS.normal, timestamp];
					break;
				case 'closed':
					Memory.rooms[roomName][RMEM.ROOM_STATUS] = [RMEM_ROOM_STATUS.closed, timestamp];
					break;
				case 'novice':
					Memory.rooms[roomName][RMEM.ROOM_STATUS] = [RMEM_ROOM_STATUS.novice, timestamp];
					break;
				case 'respawn':
					Memory.rooms[roomName][RMEM.ROOM_STATUS] = [RMEM_ROOM_STATUS.respawn, timestamp];
					break;
			}
		}
		const [statusCompressed, timestampCompressed] = Memory.rooms[roomName][RMEM.ROOM_STATUS]!;
		const timestamp = timestampCompressed * 1000;
		switch (statusCompressed) {
			case RMEM_ROOM_STATUS.normal:
				return {status: 'normal', timestamp: null};
			case RMEM_ROOM_STATUS.closed:
				return {status: 'closed', timestamp: null};
			case RMEM_ROOM_STATUS.novice:
				return {status: 'novice', timestamp: timestamp};
			case RMEM_ROOM_STATUS.respawn:
				return {status: 'respawn', timestamp: timestamp};
		}
	}

	static run(): void {

		let alreadyComputedScore = false;

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
			if (Game.time >= (room.memory[MEM.EXPIRATION] || 0) && Cartographer.roomType(name) != 'ALLEY') {
				this.recordPermanentObjects(room);
				if (!alreadyComputedScore) {
					alreadyComputedScore = this.recomputeScoreIfNecessary(room);
				}
				// Refresh cache
				const recacheTime = room.owner ? OWNED_RECACHE_TIME : RECACHE_TIME;
				room.memory[MEM.EXPIRATION] = getCacheExpiration(recacheTime, 250);
			}

			if (room.controller && Game.time % 5 == 0) {
				this.recordControllerInfo(room.controller);
			}

			this.scoutPortals(room);
		}

	}

}

// For debugging purposes
global.RoomIntel = RoomIntel;

