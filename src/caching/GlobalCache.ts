import {profile} from '../profiler/decorator';
import {getCacheExpiration} from '../utilities/utils';

const CACHE_TIMEOUT = 50;
const SHORT_CACHE_TIMEOUT = 10;

/**
 * The GlobalCache ($) module saves frequently accessed deserialized objects in temporary, volatile global memory
 */
@profile
export class $ { // $ = cash = cache... get it? :D

	static structures<T extends Structure>(saver: { ref: string }, key: string, callback: () => T[],
										   timeout = CACHE_TIMEOUT): T[] {
		const cacheKey = saver.ref + 's' + key;
		if (!_cache.structures[cacheKey] || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.structures[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		} else {
			// Refresh structure list by ID if not already done on current tick
			if ((_cache.accessed[cacheKey] || 0) < Game.time) {
				_cache.structures[cacheKey] = _.compact(_.map(_cache.structures[cacheKey] || [],
															  s => Game.getObjectById(s.id))) as Structure[];
				_cache.accessed[cacheKey] = Game.time;
			}
		}
		return _cache.structures[cacheKey] as T[];
	}

	static number(saver: { ref: string }, key: string, callback: () => number, timeout = SHORT_CACHE_TIMEOUT): number {
		const cacheKey = saver.ref + '#' + key;
		if (_cache.numbers[cacheKey] == undefined || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.numbers[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		}
		return _cache.numbers[cacheKey];
	}

	// TODO: for some reason overloading isn't working here...
	// static pos(saver: { ref: string }, key: string, callback: () => RoomPosition, timeout ?: number): RoomPosition;
	static pos(saver: { ref: string }, key: string, callback: () => RoomPosition | undefined, timeout?: number):
		RoomPosition | undefined {
		const cacheKey = saver.ref + 'p' + key;
		if (_cache.roomPositions[cacheKey] == undefined || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.roomPositions[cacheKey] = callback();
			if (!timeout) timeout = CACHE_TIMEOUT;
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		}
		return _cache.roomPositions[cacheKey];
	}

	static list<T>(saver: { ref: string }, key: string, callback: () => T[], timeout = CACHE_TIMEOUT): T[] {
		const cacheKey = saver.ref + 'l' + key;
		if (_cache.lists[cacheKey] == undefined || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.lists[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		}
		return _cache.lists[cacheKey];
	}

	static costMatrix(roomName: string, key: string, callback: () => CostMatrix,
					  timeout = SHORT_CACHE_TIMEOUT): CostMatrix {
		const cacheKey = roomName + 'm' + key;
		if (_cache.costMatrices[cacheKey] == undefined || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.costMatrices[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		}
		return _cache.costMatrices[cacheKey];
	}

	static costMatrixRecall(roomName: string, key: string): CostMatrix | undefined {
		const cacheKey = roomName + ':' + key;
		return _cache.costMatrices[cacheKey];
	}

	static set<T extends HasRef, K extends keyof T>(thing: T, key: K,
													callback: () => (T[K] & (undefined | HasID | HasID[])),
													timeout = CACHE_TIMEOUT): void {
		const cacheKey = thing.ref + '$' + key;
		if (!_cache.things[cacheKey] || Game.time > _cache.expiration[cacheKey]) {
			// Recache if new entry or entry is expired
			_cache.things[cacheKey] = callback();
			_cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
		} else {
			// Refresh structure list by ID if not already done on current tick
			if ((_cache.accessed[cacheKey] || 0) < Game.time) {
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

	static refresh<T extends Record<K, undefined | HasID | HasID[]>, K extends string>(thing: T, ...keys: K[]): void {
		_.forEach(keys, function(key) {
			if (thing[key]) {
				if (_.isArray(thing[key])) {
					thing[key] = _.compact(_.map(thing[key] as HasID[], s => Game.getObjectById(s.id))) as T[K];
				} else {
					thing[key] = Game.getObjectById((<HasID>thing[key]).id) as T[K];
				}
			}
		});
	}

	static refreshObject<T extends Record<K, { [prop: string]: undefined | HasID | HasID[] }>,
		K extends string>(thing: T, ...keys: K[]): void {
		_.forEach(keys, function(key) {
			if (_.isObject(thing[key])) {
				for (const prop in thing[key]) {
					if (_.isArray(thing[key][prop])) {
						thing[key][prop] = _.compact(_.map(thing[key][prop] as HasID[],
														   s => Game.getObjectById(s.id))) as HasID[];
					} else {
						thing[key][prop] = Game.getObjectById((<HasID>thing[key][prop]).id) as undefined | HasID;
					}
				}
			}
		});
	}

	static refreshRoom<T extends { room: Room }>(thing: T): void {
		thing.room = Game.rooms[thing.room.name];
	}

}
