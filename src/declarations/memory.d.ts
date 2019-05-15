type operationMode = 'manual' | 'semiautomatic' | 'automatic';

interface RawMemory {
	_parsed: any;
}

interface Memory {
	assimilator: any;
	Overmind: {};
	overseer: any;
	segmenter: any;
	strategist?: any;
	colonies: { [name: string]: any };
	creeps: { [name: string]: CreepMemory; };
	flags: { [name: string]: FlagMemory; };
	rooms: { [name: string]: RoomMemory; };
	spawns: { [name: string]: SpawnMemory; };
	pathing: PathingMemory;
	settings: {
		signature: string;
		operationMode: operationMode;
		log: LoggerMemory;
		enableVisuals: boolean;
		powerCollection: {
			enabled: boolean;
			maxRange: number;
			minPower: number;
		};
	}
	profiler?: any;
	stats: any;
	constructionSites: { [id: string]: number };
	// suspend?: number;
	resetBucket?: boolean;
	haltTick?: number;
	combatPlanner: any;

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
	[_MEM.OVERLORD]: string | null;
	[_MEM.COLONY]: string;
	role: string;
	task: ProtoTask | null;
	data: {
		origin: string;
	};
	noNotifications?: boolean;
	_go?: MoveData;
	debug?: boolean;
	talkative?: boolean;
}

interface MoveData {
	state: any[];
	path: string;
	delay?: number;
	fleeWait?: number;
	destination?: ProtoPos;
	priority?: number;
}

interface LoggerMemory {
	level: number;
	showSource: boolean;
	showTick: boolean;
}


interface CachedPath {
	path: RoomPosition[];
	length: number;
	tick: number;
}

interface PathingMemory {
	paths: { [originName: string]: { [destinationName: string]: CachedPath; } };
	distances: { [pos1Name: string]: { [pos2Name: string]: number; } };
	weightedDistances: { [pos1Name: string]: { [pos2Name: string]: number; } };
}

interface FlagMemory {
	[_MEM.TICK]?: number;
	[_MEM.EXPIRATION]?: number;
	[_MEM.COLONY]?: string;
	suspendUntil?: number;
	amount?: number;
	persistent?: boolean;
	setPosition?: ProtoPos;
	rotation?: number;
	parent?: string;
	maxPathLength?: number;
	maxLinearRange?: number;
	keepStorageStructures?: boolean;
	keepRoads?: boolean;
	keepContainers?: boolean;
}

// Room memory key aliases to minimize memory size

// declare const _TICK = 'T';
// declare const _EXPIRATION = 'X';
// declare const _COLONY = 'C';
// declare const _OVERLORD = 'O';
// declare const _DISTANCE = 'D';
//
// declare const _RM_AVOID = 'a';
// declare const _RM_SOURCE = 's';
// declare const _RM_CONTROLLER = 'c';
// declare const _RM_MINERAL = 'm';
// declare const _RM_SKLAIRS = 'k';
// declare const _RM_EXPANSIONDATA = 'e';
// declare const _RM_INVASIONDATA = 'v';
// declare const _RM_HARVEST = 'h';
// declare const _RM_CASUALTIES = 'd';
// declare const _RM_SAFETY = 'f';
// declare const _RM_PREVPOSITIONS = 'p';
// declare const _RM_CREEPSINROOM = 'cr';
//
// declare const _RM_IMPORTANTSTRUCTURES = 'i';
// declare const _RM_IS_TOWERS = 't';
// declare const _RM_IS_SPAWNS = 'sp';
// declare const _RM_IS_STORAGE = 's';
// declare const _RM_IS_TERMINAL = 'e';
// declare const _RM_IS_WALLS = 'w';
// declare const _RM_IS_RAMPARTS = 'r';
//
// declare const _AMOUNT = 'a';
// declare const _AVG10K = 'D';
// declare const _AVG100K = 'H';
// declare const _AVG1M = 'M';
//
// declare const _CTRL_LEVEL = 'l';
// declare const _CTRL_OWNER = 'o';
// declare const _CTRL_RESERVATION = 'r';
// declare const _CTRL_RES_USERNAME = 'u';
// declare const _CTRL_RES_TICKSTOEND = 't';
// declare const _CTRL_SAFEMODE = 's';
// declare const _CTRL_SAFEMODE_AVAILABLE = 'sa';
// declare const _CTRL_SAFEMODE_COOLDOWN = 'sc';
// declare const _CTRL_PROGRESS = 'p';
// declare const _CTRL_PROGRESSTOTAL = 'pt';
//
// declare const _MNRL_MINERALTYPE = 't';
// declare const _MNRL_DENSITY = 'd';

declare const enum _MEM {
	TICK       = 'T',
	EXPIRATION = 'X',
	COLONY     = 'C',
	OVERLORD   = 'O',
	DISTANCE   = 'D',
}

declare const enum _RM {
	AVOID                = 'a',
	SOURCES              = 's',
	CONTROLLER           = 'c',
	MINERAL              = 'm',
	SKLAIRS              = 'k',
	EXPANSION_DATA       = 'e',
	INVASION_DATA        = 'v',
	HARVEST              = 'h',
	CASUALTIES           = 'd',
	SAFETY               = 'f',
	PREV_POSITIONS       = 'p',
	CREEPS_IN_ROOM       = 'cr',
	IMPORTANT_STRUCTURES = 'i'
}

declare const enum _RM_IS {
	TOWERS   = 't',
	SPAWNS   = 'sp',
	STORAGE  = 's',
	TERMINAL = 'e',
	WALLS    = 'w',
	RAMPARTS = 'r',
}

declare const enum _RM_CTRL {
	LEVEL              = 'l',
	OWNER              = 'o',
	RESERVATION        = 'r',
	RES_USERNAME       = 'u',
	RES_TICKSTOEND     = 't',
	SAFEMODE           = 's',
	SAFEMODE_AVAILABLE = 'sa',
	SAFEMODE_COOLDOWN  = 'sc',
	PROGRESS           = 'p',
	PROGRESS_TOTAL     = 'pt',
}

declare const enum _RM_MNRL {
	MINERALTYPE = 't',
	DENSITY     = 'd',
}

declare const enum _ROLLING_STATS {
	AMOUNT  = 'a',
	AVG10K  = 'D',
	AVG100K = 'H',
	AVG1M   = 'M',
}


interface RollingStats {
	[_ROLLING_STATS.AMOUNT]: number;
	[_ROLLING_STATS.AVG10K]: number;
	[_ROLLING_STATS.AVG100K]: number;
	[_ROLLING_STATS.AVG1M]: number;
	[_MEM.TICK]: number;
}

interface ExpansionData {
	score: number;
	bunkerAnchor: string;
	outposts: { [roomName: string]: number };
}

interface RoomMemory {
	[_MEM.EXPIRATION]?: number;
	[_MEM.TICK]?: number;
	[_RM.AVOID]?: boolean;
	[_RM.SOURCES]?: SavedSource[];
	[_RM.CONTROLLER]?: SavedController | undefined;
	[_RM.MINERAL]?: SavedMineral | undefined;
	[_RM.SKLAIRS]?: SavedRoomObject[];
	[_RM.IMPORTANT_STRUCTURES]?: {
		// Positions of important structures relevant to sieges
		[_RM_IS.TOWERS]: string[];
		[_RM_IS.SPAWNS]: string[];
		[_RM_IS.STORAGE]: string | undefined;
		[_RM_IS.TERMINAL]: string | undefined;
		[_RM_IS.WALLS]: string[];
		[_RM_IS.RAMPARTS]: string[];
	} | undefined;
	[_RM.EXPANSION_DATA]?: ExpansionData | false;
	[_RM.INVASION_DATA]?: {
		harvested: number;
		lastSeen: number;
	};
	[_RM.HARVEST]?: RollingStats;
	[_RM.CASUALTIES]?: {
		cost: RollingStats
	};
	[_RM.SAFETY]?: SafetyData;
	[_RM.PREV_POSITIONS]?: { [creepID: string]: ProtoPos };
	[_RM.CREEPS_IN_ROOM]?: { [tick: number]: string[] };
}

interface SavedRoomObject {
	c: string; 	// coordinate name
}

interface SavedSource extends SavedRoomObject {
	contnr: string | undefined;
}

interface SavedController extends SavedRoomObject {
	[_RM_CTRL.LEVEL]: number;
	[_RM_CTRL.OWNER]: string | undefined;
	[_RM_CTRL.RESERVATION]: {
		[_RM_CTRL.RES_USERNAME]: string,
		[_RM_CTRL.RES_TICKSTOEND]: number,
	} | undefined;
	[_RM_CTRL.SAFEMODE]: number | undefined;
	[_RM_CTRL.SAFEMODE_AVAILABLE]: number;
	[_RM_CTRL.SAFEMODE_COOLDOWN]: number | undefined;
	[_RM_CTRL.PROGRESS]: number | undefined;
	[_RM_CTRL.PROGRESS_TOTAL]: number | undefined;
}

interface SavedMineral extends SavedRoomObject {
	[_RM_MNRL.MINERALTYPE]: MineralConstant;
	[_RM_MNRL.DENSITY]: number;
}

interface SafetyData {
	safeFor: number;
	unsafeFor: number;
	safety1k: number;
	safety10k: number;
	tick: number;
}
