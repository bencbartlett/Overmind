export enum Priority {
	Critical   = 0, 	// Emergency things that disrupt normal operation, like bootstrapping or recovering from a crash
	High       = 1,
	NormalHigh = 2,
	Normal     = 3, 	// Most operations go with Normal(*) priority
	NormalLow  = 4,
	Low        = 5, 	// Unimportant operations
}

export function blankPriorityQueue() {
	const queue: { [priority: number]: any[] } = {};
	for (const priority in Priority) {
		queue[priority] = [];
	}
	return queue;
}
