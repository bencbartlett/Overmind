import {Colony} from '../Colony';
import {getCacheExpiration, maxBy, minBy} from '../utilities/utils';

const structureScores: { [structureType: string]: number } = {
	[STRUCTURE_TERMINAL]: 30,
	[STRUCTURE_STORAGE] : 30,
	[STRUCTURE_NUKER]   : 20,
	[STRUCTURE_LAB]     : 15,
	[STRUCTURE_SPAWN]   : 15,
	[STRUCTURE_RAMPART] : 10,
	[STRUCTURE_TOWER]   : 10,
	[STRUCTURE_WALL]    : 5,
};

interface NukePlan {
	score: number;
	pos: ProtoPos;
}

interface NukeLaunchMemory {
	pos: RoomPosition;
	ticksToLand: number;
}

type AutoNukeMode = 'barrage' | 'single';

interface NukePlannerMemory {

	nukes: NukeLaunchMemory[];

	targetRooms: {
		[roomName: string]: {
			operation?: {
				mode: AutoNukeMode,
				priority: number,
			},
			intel?: {
				plan: NukePlan,
				[_MEM.EXPIRATION]: number
			}
		}
	};

}


const defaultNukePlannerMemory: NukePlannerMemory = {
	nukes      : [],
	targetRooms: {}
};

const EVALUATE_ROOM_EXPIRATION = NUKER_COOLDOWN / 4;

export class NukePlanner {

	constructor() {
		_.defaults(this.memory, defaultNukePlannerMemory);
	}

	get memory(): NukePlannerMemory {
		return Memory.nukePlanner;
	}

	private isValidNukeTarget(room: Room): boolean {
		return !!room.controller && room.controller.level >= 7 && !!room.controller.owner;
	}

	private evaluateRoom(room: Room) {
		if (!this.isValidNukeTarget(room)) {
			delete this.memory.targetRooms[room.name];
			return;
		}

		if (!this.memory.targetRooms[room.name]) {
			this.memory.targetRooms[room.name] = {};
		}

		const expiration = this.memory.targetRooms[room.name].intel
						   ? this.memory.targetRooms[room.name].intel![_MEM.EXPIRATION] : -1;

		if (Game.time < expiration) {
			return;
		}

		const scanStructures = _.filter(room.structures, s => structureScores[s.structureType]);

		const structureScore = (structure: Structure) => _.sum(structure.pos.findInRange(scanStructures, 2),
															   s => (structureScores[s.structureType] || 0));

		const bestStructure = maxBy(scanStructures, structure => !structure.pos.lookFor(LOOK_NUKES)
																 ? structureScore(structure)
																 : 0.7 * structureScore(structure));

		if (bestStructure) {
			this.memory.targetRooms[room.name].intel = {
				plan             : {
					pos  : bestStructure.pos,
					score: structureScore(bestStructure)
				},
				[_MEM.EXPIRATION]: getCacheExpiration(EVALUATE_ROOM_EXPIRATION, 100)
			};
		}
	}

	private handleNuker(colony: Colony): RoomPosition | undefined {

		if (!colony.nuker ||
			colony.nuker.cooldown > 0 ||
			colony.nuker.ghodium < colony.nuker.ghodiumCapacity ||
			colony.nuker.energy < colony.nuker.energyCapacity) {
			return;
		}

		const targetRoomName = minBy(_.keys(this.memory.targetRooms), roomName => {
			if (Game.map.getRoomLinearDistance(colony.name, roomName) <= NUKE_RANGE
				&& this.memory.targetRooms[roomName].operation) {
				return this.memory.targetRooms[roomName].operation!.priority;
			}
			return false;
		});

		if (!targetRoomName) {
			return;
		}

		const nukesInRoom = _.filter(this.memory.nukes, nukeMem => nukeMem.pos.roomName == targetRoomName);

		if (_.any(nukesInRoom, nuke => NUKE_LAND_TIME - nuke.ticksToLand < CONTROLLER_NUKE_BLOCKED_UPGRADE)) {
			// Try to keep a 200-tick separation between nuke strikes
			return;
		}

		const intel = this.memory.targetRooms[targetRoomName].intel;
		if (intel && intel.plan && intel[_MEM.EXPIRATION]) {

		}

		if (Game.rooms[targetRoomName]) {
			this.evaluateRoom(Game.rooms[targetRoomName]);
		} else {
			this.requestVision(targetRoomName);
		}


	}

	private requestVision(roomName: string) {

	}

	nukeRoom(roomName: string, mode: AutoNukeMode, priority: number) {
		if (!this.memory.targetRooms[roomName]) {
			this.memory.targetRooms[roomName] = {};
		}
		this.memory.targetRooms[roomName].operation = {
			mode    : mode,
			priority: priority,
		};
		if (Game.rooms[roomName]) {
			this.evaluateRoom(Game.rooms[roomName]);
		} else {
			this.requestVision(roomName);
		}
	}

	init() {

	}

	run() {

	}


}
