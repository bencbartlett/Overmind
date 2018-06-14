import {profile} from '../profiler/decorator';
import {Mem} from '../Memory';

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
		Memory.stats['memory.used'] = RawMemory.get().length;
	}

	static log(key: string, value: number | undefined, truncateNumbers = true): void {
		if (truncateNumbers && typeof value == 'number') {
			let decimals = 5;
			value = value.truncate(decimals);
		}
		Mem.setDeep(Memory.stats, key, value);
	}

	static accumulate(key: string, value: number): void {
		if (!Memory.stats[key]) {
			Memory.stats[key] = 0;
		}
		Memory.stats[key] += value;
	}

	static run() {
		// Log GCL
		this.log('gcl.progress', Game.gcl.progress);
		this.log('gcl.progressTotal', Game.gcl.progressTotal);
		this.log('gcl.level', Game.gcl.level);
		// Log memory usage
		this.log('memory.used', RawMemory.get().length);
		// Log CPU
		this.log('cpu.getUsed', Game.cpu.getUsed());
		this.log('cpu.limit', Game.cpu.limit);
		this.log('cpu.bucket', Game.cpu.bucket);
	}
}
