import {Colony, getAllColonies} from '../Colony';
import {log} from '../console/log';
import {DEFAULT_MAX_PATH_LENGTH} from '../directives/Directive';
import {Hatchery, SpawnRequest} from '../hiveClusters/hatchery';
import {Mem} from '../memory/Memory';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {getCacheExpiration, minBy, onPublicServer} from '../utilities/utils';

interface SpawnGroupMemory {
	colonies: string[];
	distances: { [colonyName: string]: number };
	// routes: { [colonyName: string]: { [roomName: string]: boolean } };
	// paths: { [colonyName: string]: { startPos: RoomPosition, path: string[] } }
	// tick: number;
	expiration: number;
}

const getDefaultSpawnGroupMemory: () => SpawnGroupMemory = () => ({
	colonies  : [],
	distances : {},
	// routes    : {},
	// paths    : {},
	expiration: 0,
});


const MAX_LINEAR_DISTANCE = 10; // maximum linear distance to search for ANY spawn group
const DEFAULT_RECACHE_TIME = onPublicServer() ? 2000 : 1000;

const defaultSettings: SpawnGroupSettings = {
	maxPathDistance   : 4 * 50,		// override default path distance
	requiredRCL       : 7,
	maxLevelDifference: 0,
	// flexibleEnergy    : true,
};

export interface SpawnGroupSettings {
	maxPathDistance: number;	// maximum path distance colonies can spawn creeps to
	requiredRCL: number;		// required RCL of colonies to contribute
	maxLevelDifference: number; // max difference from the colony with highest RCL to be included in spawn group
	// flexibleEnergy: boolean;	// whether to enforce that only the largest possible creeps are spawned
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
	private _colonies: Colony[] | undefined;

	constructor(initializer: SpawnGroupInitializer, settings: Partial<SpawnGroupSettings> = {}) {
		this.roomName = initializer.pos.roomName;
		// this.room = initializer.room;
		if (!Memory.rooms[this.roomName]) {
			Memory.rooms[this.roomName] = {};
		}
		this.memory = Mem.wrap(Memory.rooms[this.roomName], 'spawnGroup', getDefaultSpawnGroupMemory);
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
			log.warning(`No colonies meet the requirements for SpawnGroup: ${this.ref}`);
		}
		this.energyCapacityAvailable = _.max(_.map(this.colonyNames,
												   roomName => Game.rooms[roomName].energyCapacityAvailable));
		this._colonies = undefined;
		Overmind.spawnGroups[this.ref] = this;
	}

	get colonies(): Colony[] {
		if (!this._colonies) {
			this._colonies = _.compact(_.map(this.colonyNames, roomName => Overmind.colonies[roomName]));
		}
		return this._colonies;
	}

	/**
	 * Refresh the state of the spawnGroup; called by the Overmind object.
	 */
	refresh() {
		this.memory = Mem.wrap(Memory.rooms[this.roomName], 'spawnGroup', getDefaultSpawnGroupMemory);
		this.requests = [];
		this._colonies = undefined;
	}

	private recalculateColonies() { // don't use settings when recalculating colonies as spawnGroups share memory
		// Get all colonies in range that are of required level, then filter out ones that are too far from best
		let coloniesInRange = _.filter(getAllColonies(), colony =>
			Game.map.getRoomLinearDistance(colony.room.name, this.roomName) <= MAX_LINEAR_DISTANCE);
		const maxColonyLevel = _.max(_.map(coloniesInRange, colony => colony.level));
		coloniesInRange = _.filter(coloniesInRange,
								   colony => maxColonyLevel - colony.level <= this.settings.maxLevelDifference);

		const colonyNames = [] as string[];
		// const routes = {} as { [colonyName: string]: { [roomName: string]: boolean } };
		// let paths = {} as { [colonyName: string]: { startPos: RoomPosition, path: string[] } };
		const distances = {} as { [colonyName: string]: number };
		for (const colony of coloniesInRange) {
			const spawn = colony.room.spawns[0];
			if (spawn) {
				// const route = Pathing.findRoute(colony.room.name, this.roomName);
				const path = Pathing.findPathToRoom(spawn.pos, this.roomName);
				if (!path.incomplete && path.path.length <= DEFAULT_MAX_PATH_LENGTH + 25) {
					colonyNames.push(colony.room.name);
					// routes[colony.room.name] = route;
					// paths[room.name] = path.path;
					distances[colony.room.name] = path.path.length;
				}
			}
		}
		this.memory.colonies = colonyNames;
		// this.memory.routes = routes;
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

		// Enqueue each requests to the hatchery with least expected wait time, which is updated after each enqueue
		for (const request of this.requests) {
			// const maxCost = bodyCost(request.setup.generateBody(this.energyCapacityAvailable));
			// const okHatcheries = _.filter(hatcheries,
			// 							  hatchery => hatchery.room.energyCapacityAvailable >= maxCost);
			const bestHatchery = minBy(hatcheries, hatchery => hatchery.getWaitTimeForPriority(request.priority) +
															   distanceTo(hatchery));
			if (bestHatchery) {
				bestHatchery.enqueue(request);
			} else {
				log.error(`Could not enqueue creep with role ${request.setup.role} in ${this.roomName} ` +
						  `for Overlord ${request.overlord.print}!`);
			}
		}
	}

	run(): void {
		// Nothing goes here
	}

}
