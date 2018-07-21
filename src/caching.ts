// Preprocessing code to be run before animation of anything

import {profile} from './profiler/decorator';
import {getCacheExpiration} from './utilities/utils';
import {DirectiveOutpost} from './directives/core/outpost';

@profile
export class GameCache implements ICache {

	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };
	outpostFlags: Flag[];

	constructor() {
		this.overlords = {};
		this.targets = {};
		this.outpostFlags = _.filter(Game.flags, flag => DirectiveOutpost.filter(flag));
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
const SHORT_CACHE_TIMEOUT = 10;

export class $ { // $ = cash = cache... get it? :D

	static structures<T extends Structure>(saver: { ref: string }, key: string, callback: () => T[],
										   timeout = CACHE_TIMEOUT): T[] {
		let cacheKey = saver.ref + ':' + key;
		if (!_cache.structures[cacheKey] || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.structures[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
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

	static number(saver: { ref: string }, key: string, callback: () => number, timeout = SHORT_CACHE_TIMEOUT): number {
		let cacheKey = saver.ref + ':' + key;
		if (_cache.numbers[cacheKey] == undefined || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.numbers[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		}
		return _cache.numbers[cacheKey];
	}

	static list<T>(saver: { ref: string }, key: string, callback: () => T[], timeout = CACHE_TIMEOUT): T[] {
		let cacheKey = saver.ref + ':' + key;
		if (_cache.lists[cacheKey] == undefined || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.lists[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		}
		return _cache.lists[cacheKey];
	}

}

