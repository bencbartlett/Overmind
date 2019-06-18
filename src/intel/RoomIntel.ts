// Room intel - provides information related to room structure and occupation

import {bodyCost} from '../creepSetups/CreepSetup';
import {isCreep} from '../declarations/typeGuards';
import {profile} from '../profiler/decorator';
import {ExpansionEvaluator} from '../strategy/ExpansionEvaluator';
import {getCacheExpiration, irregularExponentialMovingAverage} from '../utilities/utils';
import {Zerg} from '../zerg/Zerg';
import {MY_USERNAME} from '../~settings';

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
				harvested: 0,
				lastSeen : 0,
			};
		}
		const sources = room.sources;
		const invasionData = room.memory[_RM.INVASION_DATA]!;
		for (const source of sources) {
			if (source.ticksToRegeneration == 1) {
				invasionData.harvested += source.energyCapacity - source.energy;
			}
		}
		if (room.invaders.length > 0) {
			invasionData.harvested = 0;
			invasionData.lastSeen = Game.time;
		}
	}

	private static updateHarvestData(room: Room): void {
		if (!room.memory[_RM.HARVEST]) {
			room.memory[_RM.HARVEST] = {
				[_ROLLING_STATS.AMOUNT] : 0,
				[_ROLLING_STATS.AVG10K] : _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
				[_ROLLING_STATS.AVG100K]: _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
				[_ROLLING_STATS.AVG1M]  : _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
				[_MEM.TICK]             : Game.time,
			};
		}
		const harvest = room.memory[_RM.HARVEST] as RollingStats;
		for (const source of room.sources) { // TODO: this implicitly assumes all energy is harvested by me
			if (source.ticksToRegeneration == 1) {
				const dEnergy = source.energyCapacity - source.energy;
				const dTime = Game.time - harvest[_MEM.TICK] + 1; // +1 to avoid division by zero errors
				harvest[_ROLLING_STATS.AMOUNT] += dEnergy;
				harvest[_ROLLING_STATS.AVG10K] = +(irregularExponentialMovingAverage(
					dEnergy / dTime, harvest[_ROLLING_STATS.AVG10K], dTime, 10000)).toFixed(7);
				harvest[_ROLLING_STATS.AVG100K] = +(irregularExponentialMovingAverage(
					dEnergy / dTime, harvest[_ROLLING_STATS.AVG10K], dTime, 100000)).toFixed(7);
				harvest[_ROLLING_STATS.AVG1M] = +(irregularExponentialMovingAverage(
					dEnergy / dTime, harvest[_ROLLING_STATS.AVG10K], dTime, 1000000)).toFixed(7);
				harvest[_MEM.TICK] = Game.time;
			}
		}
	}

	private static updateCasualtyData(room: Room): void {
		if (!room.memory[_RM.CASUALTIES]) {
			room.memory[_RM.CASUALTIES] = {
				cost: {
					[_ROLLING_STATS.AMOUNT] : 0,
					[_ROLLING_STATS.AVG10K] : 0,
					[_ROLLING_STATS.AVG100K]: 0,
					[_ROLLING_STATS.AVG1M]  : 0,
					[_MEM.TICK]             : Game.time,
				}
			};
		}
		const casualtiesCost = room.memory[_RM.CASUALTIES]!.cost as RollingStats;
		for (const tombstone of room.tombstones) {
			if (tombstone.ticksToDecay == 1) {
				// record any casualties, which are my creeps which died prematurely
				if ((tombstone.creep.ticksToLive || 0) > 1 && tombstone.creep.owner.username == MY_USERNAME
					&& isCreep(tombstone.creep)) {
					const body = _.map(tombstone.creep.body, part => part.type);
					const lifetime = body.includes(CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
					const dCost = bodyCost(body) * (tombstone.creep.ticksToLive || 0) / lifetime;
					const dTime = Game.time - casualtiesCost[_MEM.TICK] + 1;
					casualtiesCost[_ROLLING_STATS.AMOUNT] += dCost;
					casualtiesCost[_ROLLING_STATS.AVG10K] = +(irregularExponentialMovingAverage(
						dCost / dTime, casualtiesCost[_ROLLING_STATS.AVG10K], dTime, 10000)).toFixed(7);
					casualtiesCost[_ROLLING_STATS.AVG100K] = +(irregularExponentialMovingAverage(
						dCost / dTime, casualtiesCost[_ROLLING_STATS.AVG100K], dTime, 100000)).toFixed(7);
					casualtiesCost[_ROLLING_STATS.AVG1M] = +(irregularExponentialMovingAverage(
						dCost / dTime, casualtiesCost[_ROLLING_STATS.AVG1M], dTime, 1000000)).toFixed(7);
					casualtiesCost[_MEM.TICK] = Game.time;
				}
			}
		}
	}

	/**
	 * Get the pos a creep was in on the previous tick
	 */
	static getPreviousPos(creep: Creep | Zerg): RoomPosition {
		if (creep.room.memory[_RM.PREV_POSITIONS] && creep.room.memory[_RM.PREV_POSITIONS]![creep.id]) {
			return derefRoomPosition(creep.room.memory[_RM.PREV_POSITIONS]![creep.id]);
		} else {
			return creep.pos; // no data
		}
	}

	private static recordCreepPositions(room: Room): void {
		room.memory[_RM.PREV_POSITIONS] = {};
		for (const creep of room.find(FIND_CREEPS)) {
			room.memory[_RM.PREV_POSITIONS]![creep.id] = creep.pos;
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
				safeFor  : 0,
				unsafeFor: 0,
				safety1k : 1,
				safety10k: 1,
				tick     : Game.time
			};
		}
		let safety: number;
		const safetyData = room.memory[_RM.SAFETY] as SafetyData;
		if (room.dangerousHostiles.length > 0) {
			safetyData.safeFor = 0;
			safetyData.unsafeFor += 1;
			safety = 0;
		} else {
			safetyData.safeFor += 1;
			safetyData.unsafeFor = 0;
			safety = 1;
		}
		// Compute rolling averages
		const dTime = Game.time - safetyData.tick;
		safetyData.safety1k = +(irregularExponentialMovingAverage(
			safety, safetyData.safety1k, dTime, 1000)).toFixed(5);
		safetyData.safety10k = +(irregularExponentialMovingAverage(
			safety, safetyData.safety10k, dTime, 10000)).toFixed(5);
		safetyData.tick = Game.time;
	}

	static getSafetyData(roomName: string): SafetyData {
		if (!Memory.rooms[roomName]) {
			Memory.rooms[roomName] = {};
		}
		if (!Memory.rooms[roomName][_RM.SAFETY]) {
			Memory.rooms[roomName][_RM.SAFETY] = {
				safeFor  : 0,
				unsafeFor: 0,
				safety1k : 1,
				safety10k: 1,
				tick     : Game.time
			};
		}
		return Memory.rooms[roomName][_RM.SAFETY]!;
	}

	static isInvasionLikely(room: Room): boolean {
		const data = room.memory[_RM.INVASION_DATA];
		if (!data) return false;
		if (data.lastSeen > 20000) { // maybe room is surrounded by owned/reserved rooms and invasions aren't possible
			return false;
		}
		switch (room.sources.length) {
			case 1:
				return data.harvested > 90000;
			case 2:
				return data.harvested > 75000;
			case 3:
				return data.harvested > 65000;
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


	static run(): void {
		let alreadyComputedScore = false;
		for (const name in Game.rooms) {

			const room: Room = Game.rooms[name];

			this.markVisible(room);
			this.recordSafety(room);

			// Track invasion data, harvesting, and casualties for all colony rooms and outposts
			if (Overmind.colonyMap[room.name]) { // if it is an owned or outpost room
				this.updateInvasionData(room);
				this.updateHarvestData(room);
				this.updateCasualtyData(room);
			}

			// Record previous creep positions if needed (RoomIntel.run() is executed at end of each tick)
			if (room.hostiles.length > 0) {
				this.recordCreepPositions(room);
				if (room.my) {
					this.recordCreepOccupancies(room);
				}
			}

			// Record location of permanent objects in room and recompute score as needed
			if (Game.time >= (room.memory[_MEM.EXPIRATION] || 0)) {
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

		}
	}

}

// For debugging purposes
global.RoomIntel = RoomIntel;

