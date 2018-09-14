// Room intel - provides information related to room structure and occupation

// interface SavedRoomObject {
// 	c: string; 	// coordinate name
// 	// id: string;	// id of object
// }

// interface RoomIntelMemory {
// 	[roomName: string]: {
// 		sources?: SavedRoomObject[];
// 		controller?: SavedRoomObject | undefined;
// 		mineral: SavedRoomObject | undefined;
// 		sourceKeepers?: SavedRoomObject;
// 	}
// }

import {getCacheExpiration} from '../utilities/utils';
import {ExpansionPlanner} from '../strategy/ExpansionPlanner';
import {Zerg} from '../zerg/Zerg';
import {profile} from '../profiler/decorator';

const RECACHE_TIME = 2500;
const OWNED_RECACHE_TIME = 1000;
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

	static run(): void {
		let alreadyComputedScore = false;
		for (let name in Game.rooms) {

			const room = Game.rooms[name];

			// Track invasion data for all colony rooms and outposts
			if (Overmind.colonyMap[room.name]) { // if it is an owned or outpost room
				this.updateInvasionData(room);
			}

			// Record previous creep positions if needed (RoomIntel.run() is executed at end of each tick)
			if (room.creeps.length > 0 && room.hostiles.length > 0) {
				this.recordCreepPositions(room);
			} else {
				delete room.memory.prevPositions;
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

		}
	}

}

// For debugging purposes
global.RoomIntel = RoomIntel;

