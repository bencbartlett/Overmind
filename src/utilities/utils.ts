import { Stats } from "stats/stats";

// Random utilities that don't belong anywhere else

import {alignedNewline, bullet} from './stringConstants';

export function minMax(value: number, min: number, max: number): number {
	return Math.max(Math.min(value, max), min);
}

export function hasMinerals(store: { [resourceType: string]: number }): boolean {
	for (let resourceType in store) {
		if (resourceType != RESOURCE_ENERGY && (store[<ResourceConstant>resourceType] || 0) > 0) {
			return true;
		}
	}
	return false;
}

export function getUsername(): string {
	for (let i in Game.rooms) {
		let room = Game.rooms[i];
		if (room.controller && room.controller.my) {
			return room.controller.owner.username;
		}
	}
	console.log('ERROR: Could not determine username. You can set this manually in src/settings/settings_user');
	return 'ERROR: Could not determine username.';
}

export function hasJustSpawned(): boolean {
	return _.keys(Overmind.colonies).length == 1 && _.keys(Game.creeps).length == 0 && _.keys(Game.spawns).length == 1;
}

interface toColumnsOpts {
	padChar: string,
	justify: boolean
}

export function bulleted(text: string[], aligned = true, startWithNewLine = true): string {
	if (text.length == 0) {
		return '';
	}
	let prefix = (startWithNewLine ? (aligned ? alignedNewline : '\n') : '') + bullet;
	if (aligned) {
		return prefix + text.join(alignedNewline + bullet);
	} else {
		return prefix + text.join('\n' + bullet);
	}
}

/* Create column-aligned text array from object with string key/values */
export function toColumns(obj: { [key: string]: string }, opts = {} as toColumnsOpts): string[] {
	_.defaults(opts, {
		padChar: ' ',	// Character to pad with, e.g. "." would be key........val
		justify: false 	// Right align values column?
	});

	let ret = [];
	let keyPadding = _.max(_.map(_.keys(obj), str => str.length)) + 1;
	let valPadding = _.max(_.mapValues(obj, str => str.length));

	for (let key in obj) {
		if (opts.justify) {
			ret.push(key.padRight(keyPadding, opts.padChar) + obj[key].padLeft(valPadding, opts.padChar));
		} else {
			ret.push(key.padRight(keyPadding, opts.padChar) + obj[key]);
		}
	}

	return ret;
}

/* Merges a list of store-like objects, summing overlapping keys. Useful for calculating assets from multiple sources */
export function mergeSum(objects: { [key: string]: number | undefined }[]): { [key: string]: number } {
	let ret: { [key: string]: number } = {};
	for (let object of objects) {
		for (let key in object) {
			let amount = object[key] || 0;
			if (!ret[key]) {
				ret[key] = 0;
			}
			ret[key] += amount;
		}
	}
	return ret;
}

export function coordName(coord: Coord): string {
	return coord.x + ':' + coord.y;
}

export function derefCoords(coordName: string, roomName: string): RoomPosition {
	let [x, y] = coordName.split(':');
	return new RoomPosition(parseInt(x, 10), parseInt(y, 10), roomName);
}

export function getPosFromString(str: string | undefined | null): RoomPosition | undefined {
	if (!str) return;
	let posName = _.first(str.match(/(E|W)\d+(N|S)\d+:\d+:\d+/g) || []);
	if (posName) {
		let [roomName, x, y] = posName.split(':');
		return new RoomPosition(parseInt(x, 10), parseInt(y, 10), roomName);
	}
}

export function averageBy<T>(objects: T[], iteratee: ((obj: T) => number)): number | undefined {
	if (objects.length == 0) {
		return undefined;
	} else {
		return _.sum(objects, obj => iteratee(obj)) / objects.length;
	}
}

export function minBy<T>(objects: T[], iteratee: ((obj: T) => number | false)): T | undefined {
	let minObj: T | undefined = undefined;
	let minVal = Infinity;
	let val: number | false;
	for (let i in objects) {
		val = iteratee(objects[i]);
		if (val !== false && val < minVal) {
			minVal = val;
			minObj = objects[i];
		}
	}
	return minObj;
}

export function maxBy<T>(objects: T[], iteratee: ((obj: T) => number | false)): T | undefined {
	let maxObj: T | undefined = undefined;
	let maxVal = -Infinity;
	let val: number | false;
	for (let i in objects) {
		val = iteratee(objects[i]);
		if (val !== false && val > maxVal) {
			maxVal = val;
			maxObj = objects[i];
		}
	}
	return maxObj;
}

export function logHeapStats(): void {
	if (typeof Game.cpu.getHeapStatistics === 'function') {
		let heapStats = Game.cpu.getHeapStatistics();
		let heapPercent = Math.round(100 * (heapStats.total_heap_size + heapStats.externally_allocated_size)
									 / heapStats.heap_size_limit);
		let heapSize = Math.round((heapStats.total_heap_size) / 1048576);
		let externalHeapSize = Math.round((heapStats.externally_allocated_size) / 1048576);
		let heapLimit = Math.round(heapStats.heap_size_limit / 1048576);
		console.log(`Heap usage: ${heapSize} MB + ${externalHeapSize} MB of ${heapLimit} MB (${heapPercent}%).`);
		//log Heap
		Stats.log('heap.size', heapSize);
		Stats.log('heap.externalSize', externalHeapSize);
		Stats.log('heap.limit', heapLimit);
	}
}

export function isIVM(): boolean {
	return typeof Game.cpu.getHeapStatistics === 'function';
}

export function getCacheExpiration(timeout: number, offset = 5): number {
	return Game.time + timeout + Math.round((Math.random() * offset * 2) - offset);
}

const hexChars = '0123456789abcdef';

export function randomHex(length: number): string {
	let result = '';
	for (let i = 0; i < length; i++) {
		result += hexChars[Math.floor(Math.random() * hexChars.length)];
	}
	return result;
}
