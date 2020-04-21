type operationMode = 'manual' | 'semiautomatic' | 'automatic';

/**
 * TODO make this an enum
 * 0: Basic
 * 1: Collect from enemy storage/terminal
 * 2: Collect from all sources TBD
 * 3: Collect all and mine walls for energy TBD
 */
type resourceCollectionMode = number;

interface RawMemory {
	_parsed: any;
}

interface Memory {
	tick: number;
	build: number;
	assimilator: any;
	Overmind: {};
	profiler: any;
	overseer: any;
	segmenter: any;
	roomIntel: any;
	colonies: { [name: string]: any };
	creeps: { [name: string]: CreepMemory; };
	powerCreeps: {[name: string]: PowerCreepMemory};
	flags: { [name: string]: FlagMemory; };
	rooms: { [name: string]: RoomMemory; };
	spawns: { [name: string]: SpawnMemory; };
	pathing: PathingMemory;
	constructionSites: { [id: string]: number };
	stats: any;

	// suspend?: number;
	resetBucket?: boolean;
	haltTick?: number;
	combatPlanner: any;
	playerCreepTracker: { // TODO revisit for a better longterm solution
		[playerName: string]: CreepTracker
	};
	// zoneRooms: { [roomName: string]: { [type: string]: number } };

	reinforcementLearning?: {
		enabled?: boolean;
		verbosity?: number;
		workerIndex?: number;
	};

	screepsProfiler?: any;

	settings: {
		signature: string;
		operationMode: operationMode;
		log: any;
		enableVisuals: boolean;
		allies: string[];
		resourceCollectionMode: resourceCollectionMode;
		powerCollection: {
			enabled: boolean;
			maxRange: number;
			minPower: number;
		};
		autoPoison: {
			enabled: boolean;
			maxRange: number;
			maxConcurrent: number;
		},
	};

	[otherProperty: string]: any;
}

interface StatsMemory {
	cpu: {
		getUsed: number;
		limit: number;
		bucket: number;
		usage: {
			[colonyName: string]: {
				init: number;
				run: number;
				visuals: number;
			}
		}
	};
	gcl: {
		progress: number;
		progressTotal: number;
		level: number;
	};
	colonies: {
		[colonyName: string]: {
			hatchery: {
				uptime: number;
			}
			miningSite: {
				usage: number;
				downtime: number;
			}
			storage: {
				energy: number;
			}
			rcl: {
				level: number,
				progress: number,
				progressTotal: number,
			}
		}
	};
}

interface PublicSegment {

}

interface CreepMemory {
	[MEM.OVERLORD]: string | null;
	[MEM.COLONY]: string | null;
	role: string;
	task: ProtoTask | null;
	sleepUntil?: number;
	needBoosts?: ResourceConstant[];
	data: {
		origin: string;
	};
	avoidDanger?: {
		start: number;
		timer: number;
		fallback: string;
	};
	noNotifications?: boolean;
	_go?: MoveData;
	debug?: boolean;
	talkative?: boolean;
}

interface MoveData {
	state: any[];
	path: string;
	roomVisibility: { [roomName: string]: boolean };
	delay?: number;
	fleeWait?: number;
	destination?: ProtoPos;
	priority?: number;
	// waypoints?: string[];
	// waypointsVisited?: string[];
	portaling?: boolean;
}

interface CachedPath {
	path: RoomPosition[];
	length: number;
	tick: number;
}

interface PathingMemory {
	// paths: { [originName: string]: { [destinationName: string]: CachedPath; } };
	distances: { [pos1Name: string]: { [pos2Name: string]: number; } };
	// weightedDistances: { [pos1Name: string]: { [pos2Name: string]: number; } };
}

interface CreepTracker {
	creeps: { [name: string]: number }; 	// first tick seen
	types: { [type: string]: number }; 		// amount seen
	parts: { [bodyPart: string]: number }; 	// quantity
	boosts: { [boostType: string]: number };	// how many boosts are spent
}

interface FlagMemory {
	[MEM.TICK]?: number;
	[MEM.EXPIRATION]?: number;
	[MEM.COLONY]?: string;
	[MEM.DISTANCE]?: {
		[MEM_DISTANCE.UNWEIGHTED]: number;
		[MEM_DISTANCE.WEIGHTED]: number;
		[MEM.EXPIRATION]: number;
		incomplete?: boolean;
	};
	debug?: boolean;
	amount?: number;
	persistent?: boolean;
	setPos?: ProtoPos;
	rotation?: number;
	parent?: string;
	maxPathLength?: number;
	pathNotRequired?: boolean;
	maxLinearRange?: number;
	keepStorageStructures?: boolean;
	keepRoads?: boolean;
	keepContainers?: boolean;
	// waypoints?: string[];
	allowPortals?: boolean;
	recalcColonyOnTick?: number;
}

// Room memory key aliases to minimize memory size

declare const enum MEM {
	TICK       = 'T',
	EXPIRATION = 'X',
	COLONY     = 'C',
	OVERLORD   = 'O',
	DISTANCE   = 'D',
	STATS      = 'S',
}

declare const enum MEM_DISTANCE {
	UNWEIGHTED = 'u',
	WEIGHTED   = 'w',
}





