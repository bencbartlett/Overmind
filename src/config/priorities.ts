export enum Priority {
	Critical = 0, // Emergency things that disrupt normal operation, like bootstrapping or recovering from a crash
	High     = 1, // Priority to maintain or defend an owned room
	Normal   = 2, // Most operations go with this priority
	Low      = 3, // Unimportant operations
}

export function blankPriorityQueue() {
	let queue: { [priority: number]: any[] } = {};
	for (let priority in Priority) {
		queue[priority] = [];
	}
	return queue;
}
