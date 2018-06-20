// Random utilities that don't belong anywhere else

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

import lodashMinBy from 'lodash.minby';

interface toColumnsOpts {
	padChar: string,
	justify: boolean
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

export function minBy<T>(objects: T[], iteratee: ((obj: T) => number)): T {
	return lodashMinBy(objects, iteratee);
}

export function maxBy<T>(objects: T[], iteratee: ((obj: T) => number)): T {
	let maxByIteratee: ((obj: T) => number) = (obj => -1 * iteratee(obj));
	return lodashMinBy(objects, maxByIteratee);
}
