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
	}
	profiler?: any;
	stats: any;
	constructionSites: { [id: string]: number };
	// suspend?: number;
	resetBucket?: boolean;
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
	}
	gcl: {
		progress: number;
		progressTotal: number;
		level: number;
	}
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
	}
}

interface PublicSegment {

}

interface CreepMemory {
	role: string;
	task: protoTask | null;
	overlord: string | null;
	colony: string;
	data: {
		origin: string;
	};
	noNotifications?: boolean;
	_go?: MoveData;
	debug?: boolean;
	boostLab?: string;
}

interface MoveData {
	state: any[];
	path: string;
	delay?: number;
	fleeWait?: number;
	destination?: protoPos;
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
	distances: { [pos1Name: string]: { [pos2Name: string]: number; } }
	weightedDistances: { [pos1Name: string]: { [pos2Name: string]: number; } }
}

interface FlagMemory {
	suspendUntil?: number;
	amount?: number;
	created?: number;
	persistent?: boolean;
	setPosition?: protoPos;
	rotation?: number;
	colony?: string;
	parent?: string;
	maxPathLength?: number;
	maxLinearRange?: number;
}

interface SavedRoomObject {
	c: string; 	// coordinate name
	// id: string;	// id of object
}

interface SavedSource extends SavedRoomObject {
	contnr: string | undefined;
}

interface SavedController extends SavedRoomObject {
	level: number;
	owner: string | undefined;
	res: {
		username: string,
		ticksToEnd: number,
	} | undefined;
	SM: number | undefined;
	SMavail: number;
	SMcd: number | undefined;
	prog: number | undefined;
	progTot: number | undefined;
}

interface SavedMineral extends SavedRoomObject {
	mineralType: MineralConstant;
	density: number;
}

interface RoomMemory {
	avoid?: boolean;
	src?: SavedSource[];
	ctrl?: SavedController | undefined;
	mnrl: SavedMineral | undefined;
	SKlairs?: SavedRoomObject[];
	importantStructs?: {
		// Positions of important structures relevant to sieges
		towers: string[];
		spawns: string[];
		storage: string | undefined;
		terminal: string | undefined;
		walls: string[];
		ramparts: string[];
	} | undefined;
	expansionData?: {
		score: number;
		bunkerAnchor: string;
		outposts: { [roomName: string]: number };
	} | false;
	expiration?: number;
	invasionData?: {
		harvested: number;
		lastSeen: number;
	}
	prevPositions?: { [creepID: string]: protoPos };
	tick?: number;
}
