export enum Priority {
	Critical   = 0, 	// Emergency things that disrupt normal operation, like bootstrapping or recovering from a crash
	High       = 1,
	NormalHigh = 2,
	Normal     = 3, 	// Most operations go with Normal(*) priority
	NormalLow  = 4,
	Low        = 5, 	// Unimportant operations
}

export function blankPriorityQueue() {
	let queue: { [priority: number]: any[] } = {};
	for (let priority in Priority) {
		queue[priority] = [];
	}
	return queue;
}

export const BuildPriorities: BuildableStructureConstant[] = [
	STRUCTURE_SPAWN,
	STRUCTURE_CONTAINER,
	STRUCTURE_TOWER,
	STRUCTURE_EXTENSION,
	STRUCTURE_STORAGE,
	STRUCTURE_TERMINAL,
	STRUCTURE_LINK,
	STRUCTURE_EXTRACTOR,
	STRUCTURE_LAB,
	STRUCTURE_NUKER,
	STRUCTURE_OBSERVER,
	STRUCTURE_POWER_SPAWN,
	STRUCTURE_WALL,
	STRUCTURE_RAMPART,
	STRUCTURE_ROAD,
];