import {profile} from '../profiler/decorator';

export var COLLECT_STATS_FREQUENCY = 10; // Gather stats every N ticks

@profile
export class Stats {

	static clean() {
		let protectedKeys = [
			'persistent',
		];
		for (let key in Memory.stats) {
			if (!protectedKeys.includes(key)) {
				delete Memory.stats[key];
			}
		}
	}

	static format() {
		// Memory.stats = {
		// 	cpu: {
		// 		getUsed: undefined,
		// 		limit: undefined,
		// 		bucket: undefined,
		// 		usage: {},
		// 	},
		// 	gcl: {},
		// 	colonies: {},
		// }

	}

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
		Memory.stats[key] = value;
	}

	static accumulate(key: string, value: number): void {
		if (!Memory.stats[key]) {
			Memory.stats[key] = 0;
		}
		Memory.stats[key] += value;
	}

	// static accumulate(key: string, value: number): void {
	// 	if (!Memory.permastats[key]) {
	// 		Memory.permastats[key] = 0;
	// 	}
	// 	Memory.permastats[key] += value;
	// }

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
