interface Memory {
	Overmind: {};
	colonies: { [name: string]: ColonyMemory };
	creeps: { [name: string]: CreepMemory; };
	flags: { [name: string]: FlagMemory; };
	rooms: { [name: string]: RoomMemory; };
	spawns: { [name: string]: SpawnMemory; };
	empire: any;
	pathing: PathingMemory;
	log: LoggerMemory;
	pathLengths: any;
	stats: any;
	constructionSites: { [id: string]: number };
	signature: string;
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

interface CreepMemory {
	role: string;
	task: protoTask | null;
	overlord: string | null;
	colony: string;
	data: {
		origin: string;
	};
	// Traveler components
	_trav: TravelData | null;
	_go?: MoveData;
	// Combat
	partner?: string;
	retreating?: boolean;
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
	amount?: number;
	created?: number;
	persistent?: boolean;
	// setPosition: RoomPosition;
	rotation?: number;
	colony?: string;
	parent?: string;
	// overlords: { [overlordName: string]: OverlordMemory };

	// [otherProperties: string]: any;
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
	avoid?: number;
	tick?: number;
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
}

interface SpawnMemory {
}

interface ColonyMemory {
	defcon: {
		level: number,
		tick: number,
	}

	[key: string]: any,
}

interface OverseerMemory {
}

interface OverlordMemory {

}

interface HatcheryMemory {
	// idlePos?: protoPos;
	stats: {
		uptime: number;
	};
}

interface CommandCenterMemory {
	idlePos?: protoPos;
}
