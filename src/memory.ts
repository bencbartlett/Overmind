import {Stats} from './stats/stats';
import {profile} from './profiler/decorator';

@profile
export class Mem {

	static wrap(memory: any, memName: string, defaults = {}, deep = false) {
		if (!memory[memName]) {
			memory[memName] = defaults;
		}
		if (deep) {
			_.defaultsDeep(memory[memName], defaults);
		} else {
			_.defaults(memory[memName], defaults);
		}
		return memory[memName];
	}

	private static _setDeep(object: any, keys: string[], value: any): void {
		let key = _.first(keys);
		keys = _.drop(keys);
		if (keys.length == 0) { // at the end of the recursion
			object[key] = value;
			return;
		} else {
			if (!object[key]) {
				object[key] = {};
			}
			return Mem._setDeep(object[key], keys, value);
		}
	}

	/* Recursively set a value of an object given a dot-separated key, adding intermediate properties as necessary
	 * Ex: Mem.setDeep(Memory.colonies, 'E1S1.miningSites.siteID.stats.uptime', 0.5) */
	static setDeep(object: any, keyString: string, value: any): void {
		let keys = keyString.split('.');
		return Mem._setDeep(object, keys, value);
	}

	private static formatOvermindMemory() {
		if (!Memory.Overmind) {
			Memory.Overmind = {};
		}
		if (!Memory.colonies) {
			Memory.colonies = {};
		}
	}

	private static formatPathingMemory() {
		if (!Memory.pathing) {
			Memory.pathing = {} as PathingMemory; // Hacky workaround
		}
		_.defaults(Memory.pathing, {
			paths            : {},
			distances        : {},
			weightedDistances: {},
		});
	}

	static format() {
		// Format the memory as needed, done once every global reset
		this.formatOvermindMemory();
		this.formatPathingMemory();
		// Rest of memory formatting
		if (!Memory.settings) {
			Memory.settings = {};
		}
		_.defaults(Memory.settings, {
			enableVisuals: true,
		});
		if (!Memory.stats) {
			Memory.stats = {};
		}
		if (!Memory.stats.persistent) {
			Memory.stats.persistent = {};
		}
		// Changes to ensure backwards compatibility
		this.backwardsCompatibility();
	}

	private static cleanCreeps() {
		// Clear memory for non-existent creeps
		for (let name in Memory.creeps) {
			if (!Game.creeps[name]) {
				delete Memory.creeps[name];
			}
		}
	}

	private static cleanFlags() {
		// Clear memory for non-existent flags
		for (let name in Memory.flags) {
			if (!Game.flags[name]) {
				delete Memory.flags[name];
			}
		}
	}

	private static cleanColonies() {
		// Clear memory of dead colonies
		for (let name in Memory.colonies) {
			let room = Game.rooms[name];
			if (!(room && room.my)) {
				// Delete only if "persistent" is not set - use case: praise rooms
				if (!Memory.colonies[name].persistent) {
					delete Memory.colonies[name];
				}
			}
		}
	}

	private static cleanPathingMemory() {
		let distanceCleanProbability = 1 / 1000;
		let weightedDistanceCleanProbability = 0.01;

		// Randomly clear some cached path lengths
		for (let pos1Name in Memory.pathing.distances) {
			if (_.isEmpty(Memory.pathing.distances[pos1Name])) {
				delete Memory.pathing.distances[pos1Name];
			} else {
				for (let pos2Name in Memory.pathing.distances[pos1Name]) {
					if (Math.random() < distanceCleanProbability) {
						delete Memory.pathing.distances[pos1Name][pos2Name];
					}
				}
			}
		}

		// Randomly clear weighted distances
		for (let pos1Name in Memory.pathing.weightedDistances) {
			if (_.isEmpty(Memory.pathing.weightedDistances[pos1Name])) {
				delete Memory.pathing.weightedDistances[pos1Name];
			} else {
				for (let pos2Name in Memory.pathing.weightedDistances[pos1Name]) {
					if (Math.random() < weightedDistanceCleanProbability) {
						delete Memory.pathing.weightedDistances[pos1Name][pos2Name];
					}
				}
			}
		}
	}

	static clean() {
		// Clean the memory of non-existent objects every tick
		this.cleanCreeps();
		this.cleanFlags();
		this.cleanColonies();
		this.cleanPathingMemory();
		Stats.clean();
	}

	static backwardsCompatibility() {

	}
}