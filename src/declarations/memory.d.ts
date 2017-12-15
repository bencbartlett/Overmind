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
	assignmentRef: string | null;
	assignmentPos: protoPos | null;
	objectiveRef: string | null;
	colony: string;
	data: {
		origin: string;
		replaceAt: number;
		boosts: { [resourceName: string]: boolean }; // resourceName: if boost has been performed
		moveSpeed?: number;
		sayCount?: number;
		renewMe?: boolean;
	};
	roleData: {
		[propertyName: string]: any;
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
	paths: {
		[originName: string]: {
			[destinationName: string]: CachedPath;
		}
	}
}

interface FlagMemory {
	amount?: number;
	alwaysUp?: boolean;
	maxSize?: number;
	mineralType?: MineralConstant;
	IO?: string;
	maxAmount?: number;
	assignedRoom?: string;
	role?: string;
}

interface RoomMemory {
	colony: string;
	avoid?: number;
}

interface LayoutMemory {
	map: StructureMap;
}

interface SpawnMemory {
}

interface ColonyMemory {
	overlord: OverlordMemory;
	hatchery: HatcheryMemory;
	commandCenter: CommandCenterMemory;
}

interface OverlordMemory {
}

interface HatcheryMemory {
	productionQueue: { [priority: number]: protoCreep[] };
	idlePos: protoPos;
}

interface CommandCenterMemory {
	idlePos: protoPos;
}