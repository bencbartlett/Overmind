// Preprocessing code to be run before animation of anything

import {profile} from './profiler/decorator';
import {getCacheExpiration} from './utilities/utils';

@profile
export class GameCache implements ICache {

	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };

	constructor() {
		this.overlords = {};
		this.targets = {};
		// this.structures = {};
		// this.constructionSites = {};
		// this.drops = {};
	}

	/* Generates a hash table for creeps assigned to each object: key: OLref, val: (key: role, val: names[]) */
	private cacheOverlords() {
		this.overlords = {};
		// keys: overlordRef, value: creepNames[]
		let creepNamesByOverlord = _.groupBy(_.keys(Game.creeps), name => Game.creeps[name].memory.overlord);
		for (let ref in creepNamesByOverlord) {
			// keys: roleName, value: creepNames[]
			this.overlords[ref] = _.groupBy(creepNamesByOverlord[ref], name => Game.creeps[name].memory.role);
		}
	}

	/* Generates a hash table for targets: key: TargetRef, val: targeting creep names*/
	private cacheTargets() {
		this.targets = {};
		for (let i in Game.creeps) {
			let creep = Game.creeps[i];
			let task = creep.memory.task;
			while (task) {
				if (!this.targets[task._target.ref]) this.targets[task._target.ref] = [];
				this.targets[task._target.ref].push(creep.name);
				task = task._parent;
			}
		}
	}

	build() {
		this.cacheOverlords();
		this.cacheTargets();
	}

	rebuild() {
		// Recache the cheap or critical stuff: Overlords, constructionSites, drops
		this.cacheOverlords();

	}
}


const CACHE_TIMEOUT = 50;

export class GlobalCache {

	static structures<T extends Structure>(saver: { ref: string }, key: string, callback: () => T[],
										   timeout = CACHE_TIMEOUT): T[] {
		let cacheKey = saver.ref + ':' + key;
		if (!_cache.structures[cacheKey] || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.structures[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout);
		} else {
			// Refresh structure list by ID if not already done on current tick
			if (_cache.accessed[cacheKey] < Game.time) {
				_cache.structures[cacheKey] = _.compact(_.map(_cache.structures[cacheKey],
															  s => Game.getObjectById(s.id))) as Structure[];
				_cache.accessed[cacheKey] = Game.time;
			}
		}
		return _cache.structures[cacheKey] as T[];
	}

}

