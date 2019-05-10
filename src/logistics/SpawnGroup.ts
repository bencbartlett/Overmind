import {Colony} from '../Colony';
import {log} from '../console/log';
import {bodyCost} from '../creepSetups/CreepSetup';
import {Hatchery, SpawnRequest} from '../hiveClusters/hatchery';
import {Mem} from '../memory/Memory';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {getAllColonyRooms, getCacheExpiration, minBy, onPublicServer} from '../utilities/utils';

interface SpawnGroupMemory {
	colonies: string[];
	distances: { [colonyName: string]: number };
	routes: { [colonyName: string]: { [roomName: string]: boolean } };
	// paths: { [colonyName: string]: { startPos: RoomPosition, path: string[] } }
	// tick: number;
	expiration: number;
}

const SpawnGroupMemoryDefaults: SpawnGroupMemory = {
	colonies  : [],
	distances : {},
	routes    : {},
	// paths    : {},
	expiration: 0,
};


const MAX_LINEAR_DISTANCE = 10; // maximum linear distance to search for ANY spawn group
const MAX_PATH_DISTANCE = 600;	// maximum path distance to consider for ANY spawn group
const DEFAULT_RECACHE_TIME = onPublicServer() ? 2000 : 1000;

const defaultSettings: SpawnGroupSettings = {
	maxPathDistance: 400,		// override default path distance
	requiredRCL    : 7,
	flexibleEnergy : true,
};

export interface SpawnGroupSettings {
	maxPathDistance: number;	// maximum path distance colonies can spawn creeps to
	requiredRCL: number;		// required RCL of colonies to contribute
	flexibleEnergy: boolean;	// whether to enforce that only the largest possible creeps are spawned
}

export interface SpawnGroupInitializer {
	ref: string;
	room: Room | undefined;
	pos: RoomPosition;
}


/**
 * SpawnGroup provides a decentralized method of spawning creeps from multiple nearby colonies. Use cases include
 * incubation, spawning large combat groups, etc.
 */
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
		if (!Memory.rooms[this.roomName]) {
			Memory.rooms[this.roomName] = {};
		}
		this.memory = Mem.wrap(Memory.rooms[this.roomName], 'spawnGroup', SpawnGroupMemoryDefaults);
		this.ref = initializer.ref + ':SG';
		this.stats = {
			avgDistance: (_.sum(this.memory.distances) / _.keys(this.memory.distances).length) || 100,
		};
		this.requests = [];
		this.settings = _.defaults(settings, defaultSettings) as SpawnGroupSettings;
		if (Game.time >= this.memory.expiration) {
			this.recalculateColonies();
		}
		// Compute stats
		this.colonyNames = _.filter(this.memory.colonies,
									roomName => this.memory.distances[roomName] <= this.settings.maxPathDistance &&
												Game.rooms[roomName] && Game.rooms[roomName].my &&
												Game.rooms[roomName].controller!.level >= this.settings.requiredRCL);
		if (this.colonyNames.length == 0) {
			log.warning(`No colonies meet the requirements for SwarmGroup: ${this.ref}`);
		}
		this.energyCapacityAvailable = _.max(_.map(this.colonyNames,
												   roomName => Game.rooms[roomName].energyCapacityAvailable));
		Overmind.spawnGroups[this.ref] = this;
	}

	/**
	 * Refresh the state of the spawnGroup; called by the Overmind object.
	 */
	refresh() {
		this.memory = Mem.wrap(Memory.rooms[this.roomName], 'spawnGroup', SpawnGroupMemoryDefaults);
		this.requests = [];
	}

	private recalculateColonies() { // don't use settings when recalculating colonies as spawnGroups share memory
		const colonyRoomsInRange = _.filter(getAllColonyRooms(), room =>
			Game.map.getRoomLinearDistance(room.name, this.roomName) <= MAX_LINEAR_DISTANCE);
		const colonies = [] as string[];
		const routes = {} as { [colonyName: string]: { [roomName: string]: boolean } };
		// let paths = {} as { [colonyName: string]: { startPos: RoomPosition, path: string[] } };
		const distances = {} as { [colonyName: string]: number };
		for (const colonyRoom of colonyRoomsInRange) {
			const spawn = colonyRoom.spawns[0];
			if (spawn) {
				const route = Pathing.findRoute(colonyRoom.name, this.roomName);
				const path = Pathing.findPathToRoom(spawn.pos, this.roomName, {route: route});
				if (route && !path.incomplete && path.path.length <= MAX_PATH_DISTANCE) {
					colonies.push(colonyRoom.name);
					routes[colonyRoom.name] = route;
					// paths[room.name] = path.path;
					distances[colonyRoom.name] = path.path.length;
				}
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

	/**
	 * SpawnGroup.init() must be called AFTER all hatcheries have been initialized
	 */
	init(): void {
		// Most initialization needs to be done at init phase because colonies are still being constructed earlier
		const colonies = _.compact(_.map(this.colonyNames, name => Overmind.colonies[name])) as Colony[];
		const hatcheries = _.compact(_.map(colonies, colony => colony.hatchery)) as Hatchery[];
		const distanceTo = (hatchery: Hatchery) => this.memory.distances[hatchery.pos.roomName] + 25;
		// Enqueue all requests to the hatchery with least expected wait time that can spawn full-size creep
		for (const request of this.requests) {
			const maxCost = bodyCost(request.setup.generateBody(this.energyCapacityAvailable));
			const okHatcheries = _.filter(hatcheries,
										  hatchery => hatchery.room.energyCapacityAvailable >= maxCost);
			// || this.settings.flexibleEnergy);
			const bestHatchery = minBy(okHatcheries, hatchery => hatchery.nextAvailability + distanceTo(hatchery));
			if (bestHatchery) {
				bestHatchery.enqueue(request);
			} else {
				log.warning(`Could not enqueue creep ${request.setup.role} in ${this.roomName}, ` +
							`no hatchery with ${maxCost} energy capacity`);
			}
		}
	}

	run(): void {
		// Nothing goes here
	}

}
