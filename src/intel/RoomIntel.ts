// Room intel - provides information related to room structure and occupation

import {getCacheExpiration, irregularExponentialMovingAverage} from '../utilities/utils';
import {ExpansionPlanner} from '../strategy/ExpansionPlanner';
import {Zerg} from '../zerg/Zerg';
import {profile} from '../profiler/decorator';
import {MY_USERNAME} from '../~settings';
import {bodyCost} from '../creepSetups/CreepSetup';

const RECACHE_TIME = 2500;
const OWNED_RECACHE_TIME = 1000;
const ROOM_CREEP_HISTORY_TICKS = 25;
const SCORE_RECALC_PROB = 0.05;
const FALSE_SCORE_RECALC_PROB = 0.01;

const RoomIntelMemoryDefaults = {};

@profile
export class RoomIntel {

	/* Records all info for permanent room objects, e.g. sources, controllers, etc. */
	private static recordPermanentObjects(room: Room): void {
		let savedSources: SavedSource[] = [];
		for (let source of room.sources) {
			let container = source.pos.findClosestByLimitedRange(room.containers, 2);
			savedSources.push({
								  c     : source.pos.coordName,
								  contnr: container ? container.pos.coordName : undefined
							  });
		}
		room.memory.src = savedSources;
		room.memory.ctrl = room.controller ? {
			c      : room.controller.pos.coordName,
			level  : room.controller.level,
			owner  : room.controller.owner ? room.controller.owner.username : undefined,
			res    : room.controller.reservation,
			SM     : room.controller.safeMode,
			SMavail: room.controller.safeModeAvailable,
			SMcd   : room.controller.safeModeCooldown,
			prog   : room.controller.progress,
			progTot: room.controller.progressTotal
		} : undefined;
		room.memory.mnrl = room.mineral ? {
			c          : room.mineral.pos.coordName,
			density    : room.mineral.density,
			mineralType: room.mineral.mineralType
		} : undefined;
		room.memory.SKlairs = _.map(room.keeperLairs, lair => {
			return {c: lair.pos.coordName};
		});
		if (room.controller && room.controller.owner) {
			room.memory.importantStructs = {
				towers  : _.map(room.towers, t => t.pos.coordName),
				spawns  : _.map(room.spawns, s => s.pos.coordName),
				storage : room.storage ? room.storage.pos.coordName : undefined,
				terminal: room.terminal ? room.terminal.pos.coordName : undefined,
				walls   : _.map(room.walls, w => w.pos.coordName),
				ramparts: _.map(room.ramparts, r => r.pos.coordName),
			};
		} else {
			room.memory.importantStructs = undefined;
		}
		room.memory.tick = Game.time;
	}

	// Update time-sensitive reservation and safemode info
	private static recordControllerInfo(controller: StructureController): void {
		if (controller.room.memory.ctrl) {
			controller.room.memory.ctrl.res = controller.reservation;
			controller.room.memory.ctrl.SM = controller.safeMode;
			controller.room.memory.ctrl.SMcd = controller.safeModeCooldown;
		}
	}

	private static recomputeScoreIfNecessary(room: Room): boolean {
		if (room.memory.expansionData == false) { // room is uninhabitable or owned
			if (Math.random() < FALSE_SCORE_RECALC_PROB) {
				// false scores get evaluated very occasionally
				return ExpansionPlanner.computeExpansionData(room);
			}
		} else { // if the room is not uninhabitable
			if (!room.memory.expansionData || Math.random() < SCORE_RECALC_PROB) {
				// recompute some of the time
				return ExpansionPlanner.computeExpansionData(room);
			}
		}
		return false;
	}

	private static updateInvasionData(room: Room): void {
		if (!room.memory.invasionData) {
			room.memory.invasionData = {
				harvested: 0,
				lastSeen : 0,
			};
		}
		const sources = room.sources;
		for (let source of sources) {
			if (source.ticksToRegeneration == 1) {
				room.memory.invasionData.harvested += source.energyCapacity - source.energy;
			}
		}
		if (room.invaders.length > 0) {
			room.memory.invasionData = {
				harvested: 0,
				lastSeen : Game.time,
			};
		}
	}

	private static updateHarvestData(room: Room): void {
		if (!room.memory.harvest) {
			room.memory.harvest = {
				amt    : 0,
				avg10k : _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
				avg100k: _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
				avg1M  : _.sum(room.sources, s => s.energyCapacity / ENERGY_REGEN_TIME),
				tick   : Game.time,
			};
		}
		for (let source of room.sources) { // TODO: this implicitly assumes all energy is harvested by me
			if (source.ticksToRegeneration == 1) {
				const dEnergy = source.energyCapacity - source.energy;
				const dTime = Game.time - room.memory.harvest.tick + 1; // +1 to avoid division by zero errors
				room.memory.harvest.amt += dEnergy;
				room.memory.harvest.avg10k = irregularExponentialMovingAverage(
					dEnergy / dTime, room.memory.harvest.avg10k, dTime, 10000);
				room.memory.harvest.avg100k = irregularExponentialMovingAverage(
					dEnergy / dTime, room.memory.harvest.avg100k, dTime, 100000);
				room.memory.harvest.avg1M = irregularExponentialMovingAverage(
					dEnergy / dTime, room.memory.harvest.avg1M, dTime, 1000000);
				room.memory.harvest.tick = Game.time;
			}
		}
	}

	private static updateCasualtyData(room: Room): void {
		if (!room.memory.casualties) {
			room.memory.casualties = {
				cost: {
					amt    : 0,
					avg10k : 0,
					avg100k: 0,
					avg1M  : 0,
					tick   : Game.time,
				}
			};
		}
		for (let tombstone of room.tombstones) {
			if (tombstone.ticksToDecay == 1) {
				// record any casualties, which are my creeps which died prematurely
				if ((tombstone.creep.ticksToLive || 0) > 1 && tombstone.creep.owner.username == MY_USERNAME) {
					const body = _.map(tombstone.creep.body, part => part.type);
					const lifetime = body.includes(CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
					const dCost = bodyCost(body) * (tombstone.creep.ticksToLive || 0) / lifetime;
					const dTime = Game.time - room.memory.casualties.cost.tick + 1;
					room.memory.casualties.cost.amt += dCost;
					room.memory.casualties.cost.avg10k = irregularExponentialMovingAverage(
						dCost / dTime, room.memory.casualties.cost.avg10k, dTime, 10000);
					room.memory.casualties.cost.avg100k = irregularExponentialMovingAverage(
						dCost / dTime, room.memory.casualties.cost.avg100k, dTime, 100000);
					room.memory.casualties.cost.avg1M = irregularExponentialMovingAverage(
						dCost / dTime, room.memory.casualties.cost.avg1M, dTime, 1000000);
					room.memory.casualties.cost.tick = Game.time;
				}
			}
		}
	}

	// Get the pos a creep was in on the previous tick
	static getPreviousPos(creep: Creep | Zerg): RoomPosition {
		if (creep.room.memory.prevPositions && creep.room.memory.prevPositions[creep.id]) {
			return derefRoomPosition(creep.room.memory.prevPositions[creep.id]);
		} else {
			return creep.pos; // no data
		}
	}

	private static recordCreepPositions(room: Room): void {
		room.memory.prevPositions = {};
		for (let creep of room.find(FIND_CREEPS)) {
			room.memory.prevPositions[creep.id] = creep.pos;
		}
	}

	private static recordCreepOccupancies(room: Room): void {
		if (!room.memory.creepsInRoom) {
			room.memory.creepsInRoom = {};
		}
		for (let tick in room.memory.creepsInRoom) {
			if (parseInt(tick, 10) < Game.time - ROOM_CREEP_HISTORY_TICKS) {
				delete room.memory.creepsInRoom[tick];
			}
		}
		room.memory.creepsInRoom[Game.time] = _.map(room.hostiles, creep => creep.name);
	}

	private static recordSafety(room: Room): void {
		if (!room.memory.safety) {
			room.memory.safety = {
				safeFor  : 0,
				unsafeFor: 0,
				safety1k : 1,
				safety10k: 1,
				tick     : Game.time
			};
		}
		let safety: number;
		if (room.dangerousHostiles.length > 0) {
			room.memory.safety.safeFor = 0;
			room.memory.safety.unsafeFor += 1;
			safety = 0;
		} else {
			room.memory.safety.safeFor += 1;
			room.memory.safety.unsafeFor = 0;
			safety = 1;
		}
		// Compute rolling averages
		let dTime = Game.time - room.memory.safety.tick;
		room.memory.safety.safety1k = irregularExponentialMovingAverage(
			safety, room.memory.safety.safety1k, dTime, 1000);
		room.memory.safety.safety10k = irregularExponentialMovingAverage(
			safety, room.memory.safety.safety10k, dTime, 10000);
		room.memory.safety.tick = Game.time;
	}

	static getSafetyData(roomName: string): SafetyData {
		if (!Memory.rooms[roomName].safety) {
			Memory.rooms[roomName].safety = {
				safeFor  : 0,
				unsafeFor: 0,
				safety1k : 1,
				safety10k: 1,
				tick     : Game.time
			};
		}
		return Memory.rooms[roomName].safety!;
	}

	static isInvasionLikely(room: Room): boolean {
		const data = room.memory.invasionData;
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
		if (Memory.rooms[roomName] && Memory.rooms[roomName].ctrl && Memory.rooms[roomName].ctrl!.owner) {
			if (Game.time - (Memory.rooms[roomName].tick || 0) < 25000) { // ownership expires after 25k ticks
				return Memory.rooms[roomName].ctrl!.owner;
			}
		}
	}

	static roomReservedBy(roomName: string): string | undefined {
		if (Memory.rooms[roomName] && Memory.rooms[roomName].ctrl && Memory.rooms[roomName].ctrl!.res) {
			if (Game.time - (Memory.rooms[roomName].tick || 0) < 10000) { // reservation expires after 10k ticks
				return Memory.rooms[roomName].ctrl!.res!.username;
			}
		}
	}

	static roomReservationRemaining(roomName: string): number {
		if (Memory.rooms[roomName] && Memory.rooms[roomName].ctrl && Memory.rooms[roomName].ctrl!.res) {
			const reservation = Memory.rooms[roomName].ctrl!.res as ReservationDefinition;
			let timeSinceLastSeen = Game.time - (Memory.rooms[roomName].tick || 0);
			return reservation.ticksToEnd - timeSinceLastSeen;
		}
		return 0;
	}


	static run(): void {
		let alreadyComputedScore = false;
		for (let name in Game.rooms) {

			const room: Room = Game.rooms[name];

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
			if (!room.memory.expiration || Game.time > room.memory.expiration ||
				(room.owner != this.roomOwnedBy(room.name))) {
				this.recordPermanentObjects(room);
				if (!alreadyComputedScore) {
					alreadyComputedScore = this.recomputeScoreIfNecessary(room);
				}
				// Refresh cache
				let recacheTime = room.owner ? OWNED_RECACHE_TIME : RECACHE_TIME;
				room.memory.expiration = getCacheExpiration(recacheTime, 250);
			}

			if (room.controller && Game.time % 5 == 0) {
				this.recordControllerInfo(room.controller);
			}

		}
	}

}

// For debugging purposes
global.RoomIntel = RoomIntel;

