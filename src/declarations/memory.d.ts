interface Memory {
	// [name: string]: any;
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
}

interface CreepMemory {
	role: string;
	task: protoTask | null;
	overlord: string | null;
	colony: string;
	data: {
		origin: string;
		replaceAt: number;
		boosts: { [resourceName: string]: boolean };
		moveSpeed?: number;
		// supplyRequests?: IResourceRequest[];
	};
	// Traveler components
	_travel: any;
	_trav: any;
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
	colony?: string;
	overlords: { [overlordName: string]: OverlordMemory };
}

interface RoomMemory {
	avoid?: number;
}

interface LayoutMemory {
	map: StructureMap;
}

interface SpawnMemory {
}

interface ColonyMemory {
	overseer: OverseerMemory;
	hatchery: HatcheryMemory;
	commandCenter: CommandCenterMemory;
}

interface OverseerMemory {
}

interface OverlordMemory {

}

interface HatcheryMemory {
	idlePos: protoPos;
}

interface CommandCenterMemory {
	idlePos: protoPos;
}