// SpawnGroup provides a decentralized method of spawning creeps from multiple nearby colonies. Use cases include
// incubation, spawning large combat groups, etc.

import {Hatchery, SpawnRequest} from '../hiveClusters/hatchery';
import {Mem} from '../Memory';
import {getCacheExpiration, minBy} from '../utilities/utils';
import {Colony, getAllColonies} from '../Colony';
import {Pathing} from '../movement/Pathing';
import {bodyCost} from '../overlords/CreepSetup';
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

const defaultSettings: SpawnGroupSettings = {
	maxLinearDistance: 5,
	maxPathDistance  : 250,
	recacheTime      : 2500,
	requiredRCL      : 7,
};

export interface SpawnGroupSettings {
	maxLinearDistance: number,
	maxPathDistance: number,
	recacheTime: number,
	requiredRCL: number,
}

@profile
export class SpawnGroup {

	memory: SpawnGroupMemory;
	requests: SpawnRequest[];
	hatcheries: Hatchery[];
	room: Room | undefined;
	roomName: string;
	settings: SpawnGroupSettings;
	stats: {
		avgDistance: number;
	};

	constructor(roomName: string, settings = {} as SpawnGroupSettings) {
		this.roomName = roomName;
		this.room = Game.rooms[roomName];
		this.memory = Mem.wrap(Memory.rooms[roomName], 'spawnGroup', SpawnGroupMemoryDefaults);
		this.stats = {
			avgDistance: (_.sum(this.memory.distances) / _.keys(this.memory.distances).length) || 100,
		};
		this.requests = [];
		// this.hatcheries = [];
		this.settings = settings;
		_.defaults(this.settings, defaultSettings);
	}

	private recalculateColonies() {
		let coloniesInRange = _.filter(getAllColonies(), col =>
			Game.map.getRoomLinearDistance(col.pos.roomName, this.roomName) < this.settings.maxLinearDistance
			&& (col.level >= this.settings.requiredRCL || col.pos.roomName == this.roomName));
		let colonies = [] as string[];
		let routes = {} as { [colonyName: string]: { [roomName: string]: boolean } };
		// let paths = {} as { [colonyName: string]: { startPos: RoomPosition, path: string[] } };
		let distances = {} as  { [colonyName: string]: number };
		for (let colony of coloniesInRange) {
			if (!colony.hatchery) continue;
			let route = Pathing.findRoute(colony.pos.roomName, this.roomName);
			let path = Pathing.findPathToRoom(colony.pos, this.roomName, {route: route});
			if (route && !path.incomplete && path.path.length <= this.settings.maxPathDistance) {
				colonies.push(colony.name);
				routes[colony.name] = route;
				// paths[colony.name] = path.path;
				distances[colony.name] = path.path.length;
			}
		}
		this.memory.colonies = colonies;
		this.memory.routes = routes;
		// this.memory.paths = TODO
		this.memory.distances = distances;
		this.memory.expiration = getCacheExpiration(this.settings.recacheTime, 25);
	}

	enqueue(request: SpawnRequest): void {
		this.requests.push(request);
	}

	/* SpawnGroup.init() must be called AFTER all hatcheries have been initialized */
	init(): void {
		// Most initialization needs to be done at init phase because colonies are still being constructed earlier
		if (Game.time > this.memory.expiration) {
			this.recalculateColonies();
		}
		let colonies = _.compact(_.map(this.memory.colonies, name => Overmind.colonies[name])) as Colony[];
		this.hatcheries = _.compact(_.map(colonies, colony => colony.hatchery)) as Hatchery[];
		let maxEnergyCapacity = _.max(_.map(this.hatcheries, hatchery => hatchery.room.energyCapacityAvailable));
		let distanceTo = (hatchery: Hatchery) => this.memory.distances[hatchery.pos.roomName] + 25;
		// Enqueue all requests to the hatchery with least expected wait time that can spawn full-size creep
		for (let request of this.requests) {
			let cost = bodyCost(request.setup.generateBody(maxEnergyCapacity));
			let hatcheries = _.filter(this.hatcheries, hatchery => hatchery.room.energyCapacityAvailable >= cost);
			let bestHatchery = minBy(hatcheries, hatchery => hatchery.nextAvailability + distanceTo(hatchery));
			if (bestHatchery) {
				bestHatchery.enqueue(request);
			} else {
				log.warning(`Could not enqueue creep ${request.setup.role} from spawnGroup in ${this.roomName}`);
			}
		}
	}

	run(): void {

	}

}
