// SpawnGroup provides a decentralized method of spawning creeps from multiple nearby colonies. Use cases include
// incubation, spawning large combat groups, etc.

import {Hatchery, SpawnRequest} from '../hiveClusters/hatchery';
import {Mem} from '../memory/Memory';
import {getAllColonyRooms, getCacheExpiration, minBy} from '../utilities/utils';
import {Pathing} from '../movement/Pathing';
import {bodyCost} from '../creepSetups/CreepSetup';
import {log} from '../console/log';
import {profile} from '../profiler/decorator';

interface SpawnGroupMemory {
	colonies: string[];
	distances: { [colonyName: string]: number };
	routes: { [colonyName: string]: { [roomName: string]: boolean } };
	// paths: { [colonyName: string]: { startPos: RoomPosition, path: string[] } }
	// tick: number;
	expiration: number,
}

const SpawnGroupMemoryDefaults: SpawnGroupMemory = {
	colonies  : [],
	distances : {},
	routes    : {},
	// paths    : {},
	expiration: 0,
};


const MAX_LINEAR_DISTANCE = 10; // maximum linear distance to search for any spawn group
const MAX_PATH_DISTANCE = 600;	// maximum path distance for any spawn group
const DEFAULT_RECACHE_TIME = 2000;

const defaultSettings: SpawnGroupSettings = {
	maxPathDistance: 250,		// override default path distance
	requiredRCL    : 7,
};

export interface SpawnGroupSettings {
	maxPathDistance: number,
	requiredRCL: number,
}

export interface SpawnGroupInitializer {
	ref: string;
	room: Room | undefined;
	pos: RoomPosition;
}

@profile
export class SpawnGroup {

	memory: SpawnGroupMemory;
	requests: SpawnRequest[];
	roomName: string;
	colonyNames: string[];
	energyCapacityAvailable: number;
	ref: string;
	settings: SpawnGroupSettings;
	stats: {
		avgDistance: number;
	};

	constructor(initializer: SpawnGroupInitializer, settings: Partial<SpawnGroupSettings> = {}) {
		this.roomName = initializer.pos.roomName;
		// this.room = initializer.room;
		this.memory = Mem.wrap(Memory.rooms[this.roomName], 'spawnGroup', SpawnGroupMemoryDefaults);
		this.ref = initializer.ref + ':SG';
		this.stats = {
			avgDistance: (_.sum(this.memory.distances) / _.keys(this.memory.distances).length) || 100,
		};
		this.requests = [];
		this.settings = _.defaults(settings, defaultSettings) as SpawnGroupSettings;
		if (Game.time > this.memory.expiration) {
			this.recalculateColonies();
		}
		// Compute stats
		this.colonyNames = _.filter(this.memory.colonies,
									roomName => this.memory.distances[roomName] <= this.settings.maxPathDistance &&
												Game.rooms[roomName] && Game.rooms[roomName].my &&
												Game.rooms[roomName].controller!.level >= this.settings.requiredRCL);
		this.energyCapacityAvailable = _.max(_.map(this.colonyNames,
												   roomName => Game.rooms[roomName].energyCapacityAvailable));
		Overmind.spawnGroups[this.ref] = this;
	}

	/* Refresh the state of the spawnGroup; called by the Overmind object. */
	refresh() {
		this.memory = Mem.wrap(Memory.rooms[this.roomName], 'spawnGroup', SpawnGroupMemoryDefaults);
		this.requests = [];
	}

	private recalculateColonies() { // don't use settings when recalculating colonies as spawnGroups share memory
		let roomsInRange = _.filter(getAllColonyRooms(), room =>
			Game.map.getRoomLinearDistance(room.name, this.roomName) <= MAX_LINEAR_DISTANCE);
		let colonies = [] as string[];
		let routes = {} as { [colonyName: string]: { [roomName: string]: boolean } };
		// let paths = {} as { [colonyName: string]: { startPos: RoomPosition, path: string[] } };
		let distances = {} as  { [colonyName: string]: number };
		for (let room of roomsInRange) {
			if (room.spawns.length == 0) continue;
			let route = Pathing.findRoute(room.name, this.roomName);
			let path = Pathing.findPathToRoom((room.spawns[0] || room.storage || room.controller!).pos,
											  this.roomName, {route: route});
			if (route && !path.incomplete && path.path.length <= MAX_PATH_DISTANCE) {
				colonies.push(room.name);
				routes[room.name] = route;
				// paths[room.name] = path.path;
				distances[room.name] = path.path.length;
			}
		}
		this.memory.colonies = colonies;
		this.memory.routes = routes;
		// this.memory.paths = TODO
		this.memory.distances = distances;
		this.memory.expiration = getCacheExpiration(DEFAULT_RECACHE_TIME, 25);
	}

	enqueue(request: SpawnRequest): void {
		this.requests.push(request);
	}

	/* SpawnGroup.init() must be called AFTER all hatcheries have been initialized */
	init(): void {
		// Most initialization needs to be done at init phase because colonies are still being constructed earlier
		const hatcheries = _.compact(_.map(this.colonyNames, name => Overmind.colonies[name].hatchery)) as Hatchery[];
		const distanceTo = (hatchery: Hatchery) => this.memory.distances[hatchery.pos.roomName] + 25;
		// Enqueue all requests to the hatchery with least expected wait time that can spawn full-size creep
		for (let request of this.requests) {
			let cost = bodyCost(request.setup.generateBody(this.energyCapacityAvailable));
			let okHatcheries = _.filter(hatcheries, hatchery => hatchery.room.energyCapacityAvailable >= cost);
			let bestHatchery = minBy(okHatcheries, hatchery => hatchery.nextAvailability + distanceTo(hatchery));
			if (bestHatchery) {
				bestHatchery.enqueue(request);
			} else {
				log.warning(`Could not enqueue creep ${request.setup.role} from spawnGroup in ${this.roomName}`);
			}
		}
	}

	run(): void {
		// Nothing goes here
	}

}
