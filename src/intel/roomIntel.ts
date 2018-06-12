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

const RECACHE_TIME = 1000;
const OWNED_RECACHE_TIME = 10;

const RoomIntelMemoryDefaults = {};

export class RoomIntel {

	// static get memory(): RoomIntelMemory {
	// 	return Mem.wrap(Overmind.memory, 'roomIntel', RoomIntelMemoryDefaults);
	// }

	static record(obj: RoomObject): SavedRoomObject {
		return {c: obj.pos.coordName};
	}

	/* Records all info for permanent room objects, e.g. sources, controllers, etc. */
	static recordPermanentObjects(room: Room): void {
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
		room.memory.SKlairs = _.map(room.keeperLairs, lair => this.record(lair));
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
	}

	static run(): void {
		for (let name in Game.rooms) {
			let room = Game.rooms[name];
			let isOwned = room.controller && room.controller.owner != undefined;
			if (!room.memory.tick || Game.time - room.memory.tick > RECACHE_TIME ||
				(isOwned && Game.time - room.memory.tick > OWNED_RECACHE_TIME)) {
				this.recordPermanentObjects(room);
				room.memory.tick = Game.time;
			}
		}
	}

}