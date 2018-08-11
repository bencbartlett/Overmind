import {profile} from '../profiler/decorator';
import {getCacheExpiration} from '../utilities/utils';

const CACHE_TIMEOUT = 50;
const SHORT_CACHE_TIMEOUT = 10;

@profile
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

	static costMatrix(roomName: string, key: string, callback: () => CostMatrix,
					  timeout = SHORT_CACHE_TIMEOUT): CostMatrix {
		let cacheKey = roomName + ':' + key;
		if (_cache.costMatrices[cacheKey] == undefined || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.costMatrices[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		}
		return _cache.costMatrices[cacheKey];
	}

	static costMatrixRecall(roomName: string, key: string): CostMatrix | undefined {
		let cacheKey = roomName + ':' + key;
		return _cache.costMatrices[cacheKey];
	}

	static set<T extends HasRef, K extends keyof T>(thing: T, key: K,
													callback: () => (T[K] & (undefined | HasID | HasID[])),
													timeout = CACHE_TIMEOUT) {
		let cacheKey = thing.ref + '$' + key;
		if (!_cache.things[cacheKey] || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.things[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		} else {
			// Refresh structure list by ID if not already done on current tick
			if (_cache.accessed[cacheKey] < Game.time) {
				if (_.isArray(_cache.things[cacheKey])) {
					_cache.things[cacheKey] = _.compact(_.map(_cache.things[cacheKey] as HasID[],
															  s => Game.getObjectById(s.id))) as HasID[];
				} else {
					_cache.things[cacheKey] = Game.getObjectById((<HasID>_cache.things[cacheKey]).id) as HasID;
				}
				_cache.accessed[cacheKey] = Game.time;
			}
		}
		thing[key] = _cache.things[cacheKey] as T[K] & (undefined | HasID | HasID[]);
	}

}
