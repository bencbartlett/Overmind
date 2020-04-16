// This module has been adapted from Mototroller's utf15 library:
// https://github.com/screepers/utf15


/* tslint:disable:no-bitwise prefer-for-of variable-name no-unused-expression */

import {profile} from '../profiler/decorator';

const // #define
	MAX_DEPTH          = 53,       // Number.MAX_SAFE_INTEGER === (2^53 - 1)
	SAFE_BITS          = 15,       // 15 of 16 UTF-16 bits
	UNPRINTABLE_OFFSET = 48,       // ASCII '0'
	UPPER_BOUND        = 0xFFFF,   // Max 16 bit value
	POWERS_OF_2        = [1,
						  2, 4, 8, 16,
						  32, 64, 128, 256,
						  512, 1024, 2048, 4096,
						  8192, 16384, 32768, 65536,
						  131072, 262144, 524288, 1048576,
						  2097152, 4194304, 8388608, 16777216,
						  33554432, 67108864, 134217728, 268435456,
						  536870912, 1073741824, 2147483648, 4294967296,
						  8589934592, 17179869184, 34359738368, 68719476736,
						  137438953472, 274877906944, 549755813888, 1099511627776,
						  2199023255552, 4398046511104, 8796093022208, 17592186044416,
						  35184372088832, 70368744177664, 140737488355328, 281474976710656,
						  562949953421312, 1125899906842624, 2251799813685248, 4503599627370496,
						  9007199254740992        // 2^53 max
	];

/// Maximum representable by SAFE_BITS number + 1
const UPPER_LIMIT = POWERS_OF_2[SAFE_BITS];

/// Set of lib errors
class RangeCodecError extends RangeError {
	constructor(msg: string) {
		super('[utf15][RangeError]: ' + msg);
	}
}

class TypeCodecError extends TypeError {
	constructor(msg: string) {
		super('[utf15][TypeError]: ' + msg);
	}
}


/// Throws runtime exception in case of failed condition
const assert = (condition: any, Err: any, ...str: any[]) => {
	if (!condition) throw new Err(str.reduce((o, s) => (o + s + ' '), ''));
};

/// @returns normalized UTF CodePoint
const num_to_code_point = (x: number) => {
	x = +x;
	assert(x >= 0 && x < UPPER_LIMIT, RangeCodecError, 'x out of bounds:', x);
	x += UNPRINTABLE_OFFSET;
	return x;
};

/// @returns extracted unsigned value from CodePoint
const code_point_to_num: (x: number) => number = (x) => {
	x = +x;
	assert(x >= 0 && x <= UPPER_BOUND, RangeCodecError, 'x out of bounds:', x);
	x -= UNPRINTABLE_OFFSET;
	return x;
};

const check_cfg: (cfg: Codec) => void = (cfg: Codec) => {
	let fail = false;
	fail = fail || isNaN(cfg.meta) || (cfg.meta !== 0 && cfg.meta !== 1);
	fail = fail || isNaN(cfg.array) || (cfg.array !== 0 && cfg.array !== 1);
	if (!fail) {
		(() => {
			const depth_is_array = Array.isArray(cfg.depth);
			fail = fail || (depth_is_array && !cfg.array);
			if (fail) return;

			const fail_depth = (x: number | any) => (isNaN(x) || x <= 0 || x > MAX_DEPTH);
			if (depth_is_array) {
				(<number[]>cfg.depth).forEach((d: number, idx: number) => {
					(<number[]>cfg.depth)[idx] = +(<number[]>cfg.depth)[idx];
					fail = fail || fail_depth(d);
				});
			} else {
				cfg.depth = +cfg.depth;
				fail = fail || fail_depth(cfg.depth);
			}
		})();
	}

	if (fail) {
		let str = '[JSON.stringify() ERROR]';
		try {
			str = JSON.stringify(cfg);
		} finally {
		}
		assert(0, TypeCodecError, 'Codec config is invalid:', str);
	}
};

const serialize_meta: (str: string, meta: Codec) => string =
		  (str, meta) => {
			  const depth = Array.isArray(meta.depth) ? 0 : meta.depth;
			  return str + String.fromCodePoint(
				  num_to_code_point(meta.array),
				  num_to_code_point(depth));
		  };

const deserialize_meta: (str: string, meta: Codec, offset?: number) => [string, number] =
		  (str, meta, offset) => {
			  offset = offset || 0;
			  meta.array = code_point_to_num(<number>str.codePointAt(offset)) as 0 | 1;
			  // ^ this isn't actually 0 | 1 but all the bitwise operations just care if its non-zero
			  meta.depth = code_point_to_num(<number>str.codePointAt(offset + 1));
			  return [str.slice(offset + 2), 2];
		  };

function encode_array(res: string, values: number[]) {
	const depth_is_array = Array.isArray(this.depth);

	const fixed_depth = depth_is_array ? 0 : this.depth;
	const depths = depth_is_array ? this.depth : [];

	assert(fixed_depth || depths.length === values.length, TypeCodecError,
		   'Wrong depths array length:', depths, values);

	if (!depth_is_array) { // Save array length as meta
		res += String.fromCodePoint(num_to_code_point(values.length));
	}

	let symbol_done = 0, symbol_acc = 0;

	// Cycle over values
	for (let i = 0, len = values.length; i < len; ++i) {

		// Current value and its bit depth
		const value = values[i], depth = fixed_depth || depths[i];

		// Cycle over value bits
		for (let value_done = 0; value_done < depth;) {

			const symbol_left = SAFE_BITS - symbol_done;
			const value_left = depth - value_done;
			const bits_to_write = Math.min(symbol_left, value_left);

			let mask = Math.floor(value / POWERS_OF_2[value_done]);
			mask %= POWERS_OF_2[bits_to_write];
			mask *= POWERS_OF_2[symbol_done];

			symbol_acc += mask;
			value_done += bits_to_write;
			symbol_done += bits_to_write;

			// Output symbol ready, push it
			if (symbol_done === SAFE_BITS) {
				res += String.fromCodePoint(num_to_code_point(symbol_acc));
				symbol_done = symbol_acc = 0;
			}
		}
	}

	if (symbol_done !== 0) { // Last symbol left
		res += String.fromCodePoint(num_to_code_point(symbol_acc));
	}

	return res;
}

function decode_array(str: string, meta: Codec) {
	assert(!this.meta || meta.depth > 0 || (meta.depth === 0 && Array.isArray(this.depth)),
		   TypeCodecError, 'Array decoding error (check inputs and codec config)');

	meta.depth = meta.depth || this.depth;
	const depth_is_array = Array.isArray(meta.depth);

	let it = 0, i = 0;
	const length = depth_is_array ? (<number[]>meta.depth).length : code_point_to_num(<number>str.codePointAt(it++));
	const fixed_depth = (depth_is_array ? 0 : meta.depth) as number;
	const depths = (depth_is_array ? meta.depth : []) as number[];
	const values = new Array(length);

	let symbol_done = 0;
	let chunk = code_point_to_num(<number>str.codePointAt(it++));

	// Cycle over values
	while (i < length) {

		const depth = fixed_depth || depths[i];
		let value_acc = 0, value_done = 0;

		// Cycle over value bits
		while (value_done < depth) {
			const symbol_left = SAFE_BITS - symbol_done;
			const value_left = depth - value_done;
			const bits_to_read = Math.min(symbol_left, value_left);

			let data = Math.floor(chunk / POWERS_OF_2[symbol_done]);
			data %= POWERS_OF_2[bits_to_read];
			data *= POWERS_OF_2[value_done];

			value_acc += data;
			value_done += bits_to_read;
			symbol_done += bits_to_read;

			// The whole symbol has been processed, move to next
			if (symbol_done === SAFE_BITS) {
				// It was the last code unit, break without iterators changing
				if ((i + 1) === length && value_done === depth) break;
				chunk = code_point_to_num(<number>str.codePointAt(it++));
				symbol_done = 0;
			}
		}

		if (value_done > 0) {
			values[i++] = value_acc;
		}
	}

	return [values, it];
}

@profile
export class Codec {

	meta: 0 | 1;
	array: 0 | 1;
	depth: number | number[];

	/// Constructs codec by config or another serialized codec (this <=> cfg)
	constructor(cfg: { depth: number | number[], array?: 0 | 1 | boolean, meta?: 0 | 1 | boolean }) {
		cfg = cfg || {};
		this.meta = +(!!cfg.meta) as 0 | 1;
		this.array = +(!!cfg.array) as 0 | 1;
		this.depth = +cfg.depth || MAX_DEPTH;
		check_cfg(this);
	}

	/// @param arg -- single value or array of values to be encoded
	/// @returns encoded string
	encode(arg: number | number[]): string {
		// @ts-ignore
		assert((+Array.isArray(arg) | +(!!(arg).BYTES_PER_ELEMENT)) ^ !this.array, TypeCodecError,
			   'Incompatible codec (array <=> single value), arg =', arg);

		let res = '';

		if (this.meta) { // Save meta info
			res = serialize_meta(res, this);
		}

		if (this.array) {
			// Effectively packs array of numbers
			res = encode_array.call(this, res, arg);
		} else {
			// Packs single value, inline
			let x = +arg % POWERS_OF_2[<number>this.depth];
			const len = Math.ceil(<number>this.depth / SAFE_BITS);
			for (let i = 0; i < len; ++i) {
				const cp = num_to_code_point(x % UPPER_LIMIT);
				res += String.fromCodePoint(cp);
				x = Math.floor(x / UPPER_LIMIT);
			}
		}

		return res;
	}

	/// @param str -- string to be decoded
	/// @param length_out -- output, read length will be saved as "length_out.length" (optional)
	/// @returns decoded single value or array of values
	decode(str: string, length_out?: any) {
		let meta = null;    // codec config
		let length = 0;     // number of read code units

		if (this.meta) {
			// Meta has been saved to str, restore
			[str, length] = deserialize_meta(str, (meta = {} as Codec));
		} else {
			// Otherwise, use this config
			meta = this;
		}

		// @ts-ignore
		assert(meta.array ^ !this.array, TypeCodecError,
			   'Incompatible codec (array <=> single value), str =', str);

		if (this.array) { // output is array of integers
			const res = decode_array.call(this, str, meta);
			!!length_out && (length_out.length = length + res[1]);
			return res[0];
		}

		let acc = 0, pow = 0;
		const len = Math.ceil(<number>meta.depth / SAFE_BITS);
		for (let i = 0; i < len; ++i) {
			const x = code_point_to_num(<number>str.codePointAt(i));
			acc += x * POWERS_OF_2[pow];
			pow += SAFE_BITS;
		}

		!!length_out && (length_out.length = length + len);
		return acc;
	}
}

export function testEncoder() {

	const ogStart = Game.cpu.getUsed();

	let start, elapsed: number;

	console.log(`Collecting ids and positions...`);

	start = Game.cpu.getUsed();
	const allIds = [];
	const allPos = [];
	for (const name in Game.creeps) {
		allIds.push(Game.creeps[name].id);
		allPos.push(Game.creeps[name].pos);
	}
	for (const id in Game.structures) {
		allIds.push(id);
		allPos.push(Game.structures[id].pos);
	}
	console.log(`Time elapsed: ${Game.cpu.getUsed() - start}`);


	// Test id packing
	const idCodec = new Codec({depth: 4, array: 1});

	console.log(`Testing id encoding...`);
	start = Game.cpu.getUsed();
	const idsPacked = [];
	for (let k = 0, biglen = allIds.length; k < biglen; ++k) {
		const values = [];
		for (let i = 0, len = allIds[k].length; i < len; ++i) {
			const point = parseInt(allIds[k][i], 16);
			values.push(point);
		}
		idsPacked.push(idCodec.encode(values));
	}
	elapsed = Game.cpu.getUsed() - start;
	console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / idsPacked.length}`);
	console.log(`Unpacked len: ${JSON.stringify(allIds).length} | Packed len: ${JSON.stringify(idsPacked).length}`);

	console.log(`Testing id decoding...`);
	start = Game.cpu.getUsed();
	const idsUnpacked = [];
	for (let k = 0, biglen = idsPacked.length; k < biglen; ++k) {
		idsUnpacked.push(idCodec.decode(idsPacked[k]).reduce((acc: string, x: number) => (acc + x.toString(16)), ''));
	}
	elapsed = Game.cpu.getUsed() - start;
	console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / idsUnpacked.length}`);

	let idsEqual = true;
	for (let i = 0; i < allIds.length; i++) {
		if (idsUnpacked[i] != allIds[i]) {
			idsEqual = false;
			break;
		}
	}
	console.log(`Retrieved ids are equal: ${idsEqual}`);

	// Test pos packing
	function getRoomValues(roomName: string): [number, number, number] {
		const coordinateRegex = /(E|W)(\d+)(N|S)(\d+)/g;
		const match = coordinateRegex.exec(roomName)!;

		const xDir = match[1];
		const x = Number(match[2]);
		const yDir = match[3];
		const y = Number(match[4]);

		let q;
		if (xDir == 'W') {
			if (yDir == 'N') {
				q = 0;
			} else {
				q = 1;
			}
		} else {
			if (yDir == 'N') {
				q = 2;
			} else {
				q = 3;
			}
		}

		return [q, x, y];
	}

	function getRoomPosValues(pos: RoomPosition): [number, number, number, number, number] {
		const [q, x, y] = getRoomValues(pos.roomName);
		return [q, x, y, pos.x, pos.y];
	}

	function getRoomPos(args: number[]) {
		const [q, mx, my, x, y] = args;
		let roomName: string;
		switch (q) {
			case 0:
				roomName = 'W' + mx + 'N' + my;
				break;
			case 1:
				roomName = 'W' + mx + 'S' + my;
				break;
			case 2:
				roomName = 'E' + mx + 'N' + my;
				break;
			case 3:
				roomName = 'E' + mx + 'S' + my;
				break;
			default:
				roomName = 'ERROR';
		}
		return new RoomPosition(x, y, roomName);
	}

	const depths = [2, 6, 6, 6, 6];
	const posCodec = new Codec({depth: depths, array: 1});

	console.log(`Testing room position packing...`);
	start = Game.cpu.getUsed();
	const posPacked = [];
	for (let k = 0, biglen = allPos.length; k < biglen; ++k) {
		posPacked.push(posCodec.encode(getRoomPosValues(allPos[k])));
	}
	elapsed = Game.cpu.getUsed() - start;
	console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / posPacked.length}`);
	console.log(`Unpacked len: ${JSON.stringify(allPos).length} | Packed len: ${JSON.stringify(posPacked).length}`);

	console.log(`Testing room position unpacking...`);
	start = Game.cpu.getUsed();
	const posUnpacked = [];
	for (let k = 0, biglen = posPacked.length; k < biglen; ++k) {
		posUnpacked.push(getRoomPos(posCodec.decode(posPacked[k])));
	}
	elapsed = Game.cpu.getUsed() - start;
	console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / posUnpacked.length}`);

	let posEqual = true;
	for (let i = 0; i < allPos.length; i++) {
		if (!posUnpacked[i].isEqualTo(allPos[i])) {
			posEqual = false;
			break;
		}
	}
	console.log(`Retrieved positions are equal: ${posEqual}`);

	console.log(`Total time elapsed: ${Game.cpu.getUsed() - ogStart}`);

}




