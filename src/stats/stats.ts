import {profile} from '../profiler/decorator';

export var COLLECT_STATS_FREQUENCY = 10; // Gather stats every N ticks

@profile
export class Stats {

	// static format() {
	// 	Memory.stats = {
	// 		cpu: {
	// 			getUsed: undefined,
	// 			limit: undefined,
	// 			bucket: undefined,
	// 			usage: {},
	// 		},
	// 		gcl: {},
	// 		colonies: {},
	// 	}
	// }

	static cpu() {
		Memory.stats['cpu.getUsed'] = Game.cpu.getUsed();
		Memory.stats['cpu.limit'] = Game.cpu.limit;
		Memory.stats['cpu.bucket'] = Game.cpu.bucket;
	}

	static gcl() {
		Memory.stats['gcl.progress'] = Game.gcl.progress;
		Memory.stats['gcl.progressTotal'] = Game.gcl.progressTotal;
		Memory.stats['gcl.level'] = Game.gcl.level;
    }

    static memory() {
        Memory.stats['memory.used'] = RawMemory.get().length
    }

	static log(key: string, value: number | undefined): void {
		// if (Game.time % COLLECT_STATS_FREQUENCY == 1) {
		Memory.stats[key] = value;
		// }
	}

	static run() {
		// Create a stats object if needed
		if (!Memory.stats) {
			Memory.stats = {};
		}
		//
		// Memory.stats = {};

		// Run all logging functions
		// if (Game.time % COLLECT_STATS_FREQUENCY == 1) {
		// 	Memory.stats = {}; // Overwrite old / deprecated stats
		this.cpu();
        this.gcl();
        this.memory();
		// }
	}

}
