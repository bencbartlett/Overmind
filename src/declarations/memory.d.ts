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
	// stats: StatsMemory;
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
	// task: protoTask | null;
	overlord: string | null;
	colony: string;
	data: {
		origin: string;
		replaceAt: number;
		boosts: { [resourceName: string]: boolean };
		moveSpeed?: number;
	};
	// Traveler components
	// _travel: any;
	_trav: TravelData | null;
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
	setPosition: RoomPosition;
	rotation?: number;
	colony?: string;
	parent?: string;
	overlords: { [overlordName: string]: OverlordMemory };

	// [otherProperties: string]: any;
}

interface RoomMemory {
	avoid?: number;
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

interface MiningSiteMemory {
	stats: {
		usage: number;
		downtime: number;
	};
}

interface HatcheryMemory {
	idlePos: protoPos;
	stats: {
		uptime: number;
	};
}

interface CommandCenterMemory {
	idlePos: protoPos;
}