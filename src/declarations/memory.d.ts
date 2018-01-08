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
	// assignmentRef: string | null;
	// assignmentPos: protoPos | null;
	// objectiveRef: string | null;
	overlord: string | null;
	colony: string;
	data: {
		origin: string;
		replaceAt: number;
		boosts: { [resourceName: string]: boolean }; // resourceName: if boost has been performed
		moveSpeed?: number;
		supplyRequests?: IResourceRequest[];
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
	// amount?: number;
	// alwaysUp?: boolean;
	// maxSize?: number;
	// mineralType?: MineralConstant;
	// IO?: string;
	// maxAmount?: number;
	// assignedRoom?: string;
	// role?: string;
	colony?: string;
	overlords: { [overlordName: string]: OverlordMemory };
}

interface RoomMemory {
	// colony: string;
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
	// productionQueue: { [priority: number]: protoCreep[] };
	idlePos: protoPos;
}

interface CommandCenterMemory {
	idlePos: protoPos;
}