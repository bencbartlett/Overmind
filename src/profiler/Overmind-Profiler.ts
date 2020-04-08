// Internal profiler for Overmind; this can be used in conjunction with screeps-profiler

interface OvermindProfilerMemory {

}

const defaultOvermindProfilerMemory: OvermindProfilerMemory = {};

export class OvermindProfiler {

	static profile(callback: () => void, identifier: string): void {
		const start = Game.cpu.getUsed();
		callback();
		Memory.profiler[identifier] = Game.cpu.getUsed() - start;
	}

}
