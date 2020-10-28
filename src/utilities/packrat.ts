/**
 * screeps-packrat
 * ---------------
 * Lightning-fast and memory-efficient serialization of Screeps IDs, Coords, and RoomPositions
 * Code written by Muon as part of Overmind Screeps AI. Feel free to adapt as desired.
 * Package repository: https://github.com/bencbartlett/screeps-packrat
 *
 * Plain JS version is available in the #share-thy-code channel on the Screeps Slack.
 *
 * To use: import desired functions from module, or import entire module on main and use functions from global.
 * To benchmark: import tests file, PackratTests.run()
 *
 * Exported functions (available on global):
 *
 * +--------------------------+------------------------------------------------+-----------------+--------------------+
 * |         function         |                  description                   | execution time* | memory reduction** |
 * +--------------------------+------------------------------------------------+-----------------+--------------------+
 * | packId                   | packs a game object id into 6 chars            | 500ns           | -75%               |
 * | unpackId                 | unpacks 6 chars into original format           | 1.3us           |                    |
 * | packIdList               | packs a list of ids into a single string       | 500ns/id        | -81%               |
 * | unpackIdList             | unpacks a string into a list of ids            | 1.2us/id        |                    |
 * | packPos                  | packs a room position into 2 chars             | 150ns           | -90%               |
 * | unpackPos                | unpacks 2 chars into a room position           | 600ns           |                    |
 * | packPosList              | packs a list of room positions into a string   | 150ns/pos       | -95%               |
 * | unpackPosList            | unpacks a string into a list of room positions | 1.5us/pos       |                    |
 * | packCoord                | packs a coord (e.g. {x:25,y:25}) as a string   | 150ns           | -80%               |
 * | unpackCoord              | unpacks a string into a coord                  | 60-150ns        |                    |
 * | packCoordList            | packs a list of coords as a string             | 120ns/coord     | -94%               |
 * | unpackCoordList          | unpacks a string into a list of coords         | 100ns/coord     |                    |
 * | unpackCoordAsPos         | unpacks string + room name into a pos          | 500ns           |                    |
 * | unpackCoordListAsPosList | unpacks string + room name into a list of pos  | 500ns/coord     |                    |
 * +--------------------------+------------------------------------------------+-----------------+--------------------+
 *
 *  * Execution time measured on shard2 public servers and may vary on different machines or shards.
 * ** Memory reduction for list functions is the asymptotic limit of lists containing many entries. Lower reductions
 *    can be expected for smaller lists.
 *
 */

/* tslint:disable no-bitwise prefer-for-of */


/**
 * Convert a hex string to a Uint16Array.
 */
function hexToUint16Array(hex: string): Uint16Array {
	const len = Math.ceil(hex.length / 4); // four hex chars for each 16-bit value
	const array = new Uint16Array(len);
	for (let i = 0; i < hex.length; i += 4) {
		array[i >>> 2] = parseInt(hex.substr(i, 4), 16);
	}
	return array;
}

/**
 * Convert a Uint16Array to a hex string. Note that uint16ArrayToHex(hexToUint16Array('0123abce')) will
 * return '123abcde' since this does not account for zero padding. Fortunately this is not an issue for screeps, since
 * ids do not seem to be allowed to start with a 0.
 */
function uint16ArrayToHex(array: Uint16Array): string {
	const hex: string[] = [];
	let current: number;
	for (let i = 0; i < array.length; ++i) {
		current = array[i];
		hex.push((current >>> 8).toString(16));
		hex.push((current & 0xFF).toString(16));
	}
	return hex.join('');
}

/**
 * Convert a standard 24-character hex id in screeps to a compressed UTF-16 encoded string of length 6.
 *
 * Benchmarking: average of 500ns to execute on shard2 public server, reduce stringified size by 75%
 */
export function packId(id: string): string {
	return String.fromCharCode(parseInt(id.substr(0, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(4, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(8, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(12, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(16, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(20, 4), 16));
}

/**
 * Convert a compressed six-character UTF-encoded id back into the original 24-character format.
 *
 * Benchmarking: average of 1.3us to execute on shard2 public server
 */
export function unpackId(packedId: string): string {
	let id = '';
	let current: number;
	for (let i = 0; i < 6; ++i) {
		current = packedId.charCodeAt(i);
		id += (current >>> 8).toString(16).padStart(2, '0');
		id += (current & 0xFF).toString(16).padStart(2, '0');
	}
	return id;
}

/**
 * Packs a list of ids as a utf-16 string. This is better than having a list of packed coords, as it avoids
 * extra commas and "" when memroy gets stringified.
 *
 * Benchmarking: average of 500ns per id to execute on shard2 public server, reduce stringified size by 81%
 */
export function packIdList(ids: string[]): string {
	let str = '';
	for (let i = 0; i < ids.length; ++i) {
		str += packId(ids[i]);
	}
	return str;
}

/**
 * Unpacks a list of ids stored as a utf-16 string.
 *
 * Benchmarking: average of 1.2us per id to execute on shard2 public server.
 */
export function unpackIdList(packedIds: string): string[] {
	const ids: string[] = [];
	for (let i = 0; i < packedIds.length; i += 6) {
		ids.push(unpackId(packedIds.substr(i, 6)));
	}
	return ids;
}


/**
 * Packs a coord as a single utf-16 character. The seemingly strange choice of encoding value ((x << 6) | y) + 65 was
 * chosen to be fast to compute (x << 6 | y is significantly faster than 50 * x + y) and to avoid control characters,
 * as "A" starts at character code 65.
 *
 * Benchmarking: average of 150ns to execute on shard2 public server, reduce stringified size by 80%
 */
export function packCoord(coord: Coord): string {
	return String.fromCharCode(((coord.x << 6) | coord.y) + 65);
}

/**
 * Unpacks a coord stored as a single utf-16 character
 *
 * Benchmarking: average of 60ns-100ns to execute on shard2 public server
 */
export function unpackCoord(char: string): Coord {
	const xShiftedSixOrY = char.charCodeAt(0) - 65;
	return {
		x: (xShiftedSixOrY & 0b111111000000) >>> 6,
		y: (xShiftedSixOrY & 0b000000111111),
	};
}

/**
 * Unpacks a coordinate and creates a RoomPosition object from a specified roomName
 *
 * Benchmarking: average of 500ns to execute on shard2 public server
 */
export function unpackCoordAsPos(packedCoord: string, roomName: string): RoomPosition {
	const coord = unpackCoord(packedCoord);
	return new RoomPosition(coord.x, coord.y, roomName);
}

/**
 * Packs a list of coords as a utf-16 string. This is better than having a list of packed coords, as it avoids
 * extra commas and "" when memroy gets stringified.
 *
 * Benchmarking: average of 120ns per coord to execute on shard2 public server, reduce stringified size by 94%
 */
export function packCoordList(coords: Coord[]): string {
	let str = '';
	for (let i = 0; i < coords.length; ++i) {
		str += String.fromCharCode(((coords[i].x << 6) | coords[i].y) + 65);
	}
	return str;
}

/**
 * Unpacks a list of coords stored as a utf-16 string
 *
 * Benchmarking: average of 100ns per coord to execute on shard2 public server
 */
export function unpackCoordList(chars: string): Coord[] {
	const coords: Coord[] = [];
	let xShiftedSixOrY: number;
	for (let i = 0; i < chars.length; ++i) {
		xShiftedSixOrY = chars.charCodeAt(i) - 65;
		coords.push({
						x: (xShiftedSixOrY & 0b111111000000) >>> 6,
						y: (xShiftedSixOrY & 0b000000111111),
					});
	}
	return coords;
}

/**
 * Unpacks a list of coordinates and creates a list of RoomPositions from a specified roomName
 *
 * Benchmarking: average of 500ns per coord to execute on shard2 public server
 */
export function unpackCoordListAsPosList(packedCoords: string, roomName: string): RoomPosition[] {
	const positions: RoomPosition[] = [];
	let coord: Coord;
	for (let i = 0; i < packedCoords.length; ++i) {
		// Each coord is saved as a single character; unpack each and insert the room name to get the positions list
		coord = unpackCoord(packedCoords[i]);
		positions.push(new RoomPosition(coord.x, coord.y, roomName));
	}
	return positions;
}


PERMACACHE._packedRoomNames = PERMACACHE._packedRoomNames || {};
PERMACACHE._unpackedRoomNames = PERMACACHE._unpackedRoomNames || {};

/**
 * Packs a roomName as a single utf-16 character. Character values are stored on permacache.
 */
function packRoomName(roomName: string): string {
	if (PERMACACHE._packedRoomNames[roomName] === undefined) {
		const coordinateRegex = /(E|W)(\d+)(N|S)(\d+)/g;
		const match = coordinateRegex.exec(roomName)!;

		const xDir = match[1];
		const x = Number(match[2]);
		const yDir = match[3];
		const y = Number(match[4]);

		let quadrant;
		if (xDir == 'W') {
			if (yDir == 'N') {
				quadrant = 0;
			} else {
				quadrant = 1;
			}
		} else {
			if (yDir == 'N') {
				quadrant = 2;
			} else {
				quadrant = 3;
			}
		}

		// y is 6 bits, x is 6 bits, quadrant is 2 bits
		const num = (quadrant << 12 | (x << 6) | y) + 65;
		const char = String.fromCharCode(num);

		PERMACACHE._packedRoomNames[roomName] = char;
		PERMACACHE._unpackedRoomNames[char] = roomName;
	}
	return PERMACACHE._packedRoomNames[roomName];
}

/**
 * Packs a roomName as a single utf-16 character. Character values are stored on permacache.
 */
function unpackRoomName(char: string): string {
	if (PERMACACHE._unpackedRoomNames[char] === undefined) {
		const num = char.charCodeAt(0) - 65;
		const {q, x, y} = {
			q: (num & 0b11000000111111) >>> 12,
			x: (num & 0b00111111000000) >>> 6,
			y: (num & 0b00000000111111),
		};

		let roomName: string;
		switch (q) {
			case 0:
				roomName = 'W' + x + 'N' + y;
				break;
			case 1:
				roomName = 'W' + x + 'S' + y;
				break;
			case 2:
				roomName = 'E' + x + 'N' + y;
				break;
			case 3:
				roomName = 'E' + x + 'S' + y;
				break;
			default:
				roomName = 'ERROR';
		}

		PERMACACHE._packedRoomNames[roomName] = char;
		PERMACACHE._unpackedRoomNames[char] = roomName;
	}
	return PERMACACHE._unpackedRoomNames[char];
}


/**
 * Packs a RoomPosition as a pair utf-16 characters. The seemingly strange choice of encoding value ((x << 6) | y) + 65
 * was chosen to be fast to compute (x << 6 | y is significantly faster than 50 * x + y) and to avoid control
 * characters, as "A" starts at character code 65.
 *
 * Benchmarking: average of 150ns to execute on shard2 public server, reduce stringified size by 90%
 */
export function packPos(pos: RoomPosition): string {
	return packCoord(pos) + packRoomName(pos.roomName);
}

/**
 * Unpacks a RoomPosition stored as a pair of utf-16 characters.
 *
 * Benchmarking: average of 600ns to execute on shard2 public server.
 */
export function unpackPos(chars: string): RoomPosition {
	const {x, y} = unpackCoord(chars[0]);
	return new RoomPosition(x, y, unpackRoomName(chars[1]));
}

/**
 * Packs a list of RoomPositions as a utf-16 string. This is better than having a list of packed RoomPositions, as it
 * avoids extra commas and "" when memroy gets stringified.
 *
 * Benchmarking: average of 150ns per position to execute on shard2 public server, reduce stringified size by 95%
 */
export function packPosList(posList: RoomPosition[]): string {
	let str = '';
	for (let i = 0; i < posList.length; ++i) {
		str += packPos(posList[i]);
	}
	return str;
}

/**
 * Unpacks a list of RoomPositions stored as a utf-16 string.
 *
 * Benchmarking: average of 1.5us per position to execute on shard2 public server.
 */
export function unpackPosList(chars: string): RoomPosition[] {
	const posList: RoomPosition[] = [];
	for (let i = 0; i < chars.length; i += 2) {
		posList.push(unpackPos(chars.substr(i, 2)));
	}
	return posList;
}



// Useful to register these functions on global
global.packId = packId;
global.unpackId = unpackId;
global.packIdList = packIdList;
global.unpackIdList = unpackIdList;
global.packCoord = packCoord;
global.unpackCoord = unpackCoord;
global.unpackCoordAsPos  = unpackCoordAsPos;
global.packCoordList = packCoordList;
global.unpackCoordList = unpackCoordList;
global.unpackCoordListAsPosList  = unpackCoordListAsPosList;
global.packPos = packPos;
global.unpackPos = unpackPos;
global.packPosList = packPosList;
global.unpackPosList = unpackPosList;




export class PackratTests {

	static testIdPacker() {

		const ogStart = Game.cpu.getUsed();

		let start, elapsed: number;

		console.log(`Collecting ids...`);

		start = Game.cpu.getUsed();
		const allIds = [];
		for (const name in Game.creeps) {
			const id = Game.creeps[name].id;
			if (!id) {
				console.log(`Game.creeps.${name} has no id: ${id}! wtf`);
			} else {
				allIds.push();
			}
		}
		for (const id in Game.structures) {
			if (!id) {
				console.log(`Game.structures has an undefined id: ${id}! wtf`);
			} else {
				allIds.push(id);
			}
		}
		console.log(`Time elapsed: ${Game.cpu.getUsed() - start}`);


		console.log(`Testing id encoding...`);
		start = Game.cpu.getUsed();
		const idsPacked = [];
		for (let i = 0, len = allIds.length; i < len; ++i) {
			idsPacked.push(packId(allIds[i]));
		}
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / idsPacked.length}`);
		console.log(`Unpacked len: ${JSON.stringify(allIds).length} | Packed len: ${JSON.stringify(idsPacked).length}`);

		console.log(`Testing listId encoding...`);
		start = Game.cpu.getUsed();
		const idsListPacked = packIdList(allIds);
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / (idsListPacked.length / 6)}`);
		console.log(`List-packed len: ${JSON.stringify(idsListPacked).length}`);

		console.log(`Testing id decoding...`);
		start = Game.cpu.getUsed();
		const idsUnpacked = [];
		for (let i = 0, len = idsPacked.length; i < len; ++i) {
			idsUnpacked.push(unpackId(idsPacked[i]));
		}
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / idsUnpacked.length}`);

		console.log(`Testing id list-decoding...`);
		start = Game.cpu.getUsed();
		const idsListUnpacked = unpackIdList(idsListPacked);
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / idsListUnpacked.length}`);

		console.log(`Verifying equality...`);
		let idsEqual = true;
		for (let i = 0; i < allIds.length; i++) {
			if (idsUnpacked[i] != allIds[i]) {
				console.log(`Unpacked id not equal! orig: ${allIds[i]}; unpacked: ${idsUnpacked[i]}`);
				idsEqual = false;
				break;
			}
			if (idsListUnpacked[i] != allIds[i]) {
				console.log(`Unpacked id not equal! orig: ${allIds[i]}; listUnpacked: ${idsListUnpacked[i]}`);
				idsEqual = false;
				break;
			}
		}
		console.log(`Retrieved ids are equal: ${idsEqual}`);

		console.log(`Total time elapsed: ${Game.cpu.getUsed() - ogStart}`);

	}


	static testCoordPacker() {

		const ogStart = Game.cpu.getUsed();

		let start, elapsed: number;

		console.log(`Collecting positions...`);

		start = Game.cpu.getUsed();
		const allCoord: Coord[] = [];
		for (const name in Game.creeps) {
			const pos = Game.creeps[name].pos;
			allCoord.push({x: pos.x, y: pos.y});
		}
		for (const id in Game.structures) {
			const pos = Game.structures[id].pos;
			allCoord.push({x: pos.x, y: pos.y});
		}
		console.log(`Time elapsed: ${Game.cpu.getUsed() - start}`);


		console.log(`Testing coord encoding...`);

		start = Game.cpu.getUsed();
		const coordPacked = [];
		for (let i = 0, len = allCoord.length; i < len; ++i) {
			coordPacked.push(packCoord(allCoord[i]));
		}
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / coordPacked.length}`);
		console.log(`Unpacked len: ${JSON.stringify(allCoord).length}`);
		console.log(`Packed len: ${JSON.stringify(coordPacked).length}`);

		console.log(`Testing listCoord encoding...`);
		start = Game.cpu.getUsed();
		const coordListPacked = packCoordList(allCoord);
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / coordListPacked.length}`);
		console.log(`List-packed len: ${JSON.stringify(coordListPacked).length}`);


		console.log(`Testing coord decoding...`);
		start = Game.cpu.getUsed();
		const coordUnpacked = [];
		for (let i = 0, len = coordPacked.length; i < len; ++i) {
			coordUnpacked.push(unpackCoord(coordPacked[i]));
		}
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / coordUnpacked.length}`);


		console.log(`Testing listCoord decoding...`);
		start = Game.cpu.getUsed();
		const coordListUnpacked = unpackCoordList(coordListPacked);
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / coordListUnpacked.length}`);

		console.log(`Testing coord to pos decoding...`);
		start = Game.cpu.getUsed();
		const coordAsPosUnpacked = [];
		for (let i = 0, len = coordPacked.length; i < len; ++i) {
			coordAsPosUnpacked.push(unpackCoordAsPos(coordPacked[i], 'W10N10'));
		}
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / coordAsPosUnpacked.length}`);


		console.log(`Testing listCoord to posList decoding...`);
		start = Game.cpu.getUsed();
		const coordListAsPosListUnpacked = unpackCoordListAsPosList(coordListPacked, 'W10N10');
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / coordListAsPosListUnpacked.length}`);


		let posEqual = true;
		for (let i = 0; i < allCoord.length; i++) {
			if (!(allCoord[i].x == coordAsPosUnpacked[i].x && allCoord[i].y == coordAsPosUnpacked[i].y)) {
				console.log(`Unpacked pos not equal! orig: ${JSON.stringify(allCoord[i])}; `+
							`unpacked: ${JSON.stringify(coordAsPosUnpacked[i])}`);
				posEqual = false;
				break;
			}
			if (!(allCoord[i].x == coordListAsPosListUnpacked[i].x && allCoord[i].y == coordListAsPosListUnpacked[i].y)) {
				console.log(`Unpacked pos not equal! orig: ${JSON.stringify(allCoord[i])}; `+
							`unpacked: ${JSON.stringify(coordListAsPosListUnpacked[i])}`);
				posEqual = false;
				break;
			}
		}
		console.log(`Retrieved coords are equal: ${posEqual}`);

		console.log(`Total time elapsed: ${Game.cpu.getUsed() - ogStart}`);

	}


	static testPosPacker() {

		const ogStart = Game.cpu.getUsed();

		let start, elapsed: number;

		console.log(`Collecting positions...`);

		start = Game.cpu.getUsed();
		const allPos: RoomPosition[] = [];
		for (const name in Game.creeps) {
			allPos.push(Game.creeps[name].pos);
		}
		for (const id in Game.structures) {
			allPos.push(Game.structures[id].pos);
		}
		console.log(`Time elapsed: ${Game.cpu.getUsed() - start}`);


		console.log(`Testing pos encoding...`);

		start = Game.cpu.getUsed();
		const posPacked = [];
		for (let i = 0, len = allPos.length; i < len; ++i) {
			posPacked.push(packPos(allPos[i]));
		}
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / posPacked.length}`);
		console.log(`Unpacked len: ${JSON.stringify(allPos).length}`);
		console.log(`Packed len: ${JSON.stringify(posPacked).length}`);

		console.log(`Testing listPos encoding...`);
		start = Game.cpu.getUsed();
		const posListPacked = packPosList(allPos);
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / (posListPacked.length / 2)}`);
		console.log(`List-packed len: ${JSON.stringify(posListPacked).length}`);


		console.log(`Testing pos decoding...`);
		start = Game.cpu.getUsed();
		const posUnpacked = [];
		for (let i = 0, len = posPacked.length; i < len; ++i) {
			posUnpacked.push(unpackPos(posPacked[i]));
		}
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / posUnpacked.length}`);


		console.log(`Testing listPos decoding...`);
		start = Game.cpu.getUsed();
		const posListUnpacked = unpackPosList(posListPacked);
		elapsed = Game.cpu.getUsed() - start;
		console.log(`Time elapsed: ${elapsed}; avg: ${elapsed / posListUnpacked.length}`);


		let posEqual = true;
		for (let i = 0; i < allPos.length; i++) {
			if (!allPos[i].isEqualTo(posUnpacked[i])) {
				console.log(`Unpacked pos not equal! orig: ${allPos[i]}; unpacked: ${posUnpacked[i]}`);
				posEqual = false;
				break;
			}
			if (!allPos[i].isEqualTo(posListUnpacked[i])) {
				console.log(`Unpacked pos not equal! orig: ${allPos[i]}; unpacked: ${posListUnpacked[i]}`);
				posEqual = false;
				break;
			}
		}
		console.log(`Retrieved pos are equal: ${posEqual}`);

		console.log(`Total time elapsed: ${Game.cpu.getUsed() - ogStart}`);

	}

	static run() {
		PackratTests.testIdPacker();
		PackratTests.testCoordPacker();
		PackratTests.testPosPacker();
	}

}

global.PackratTests = PackratTests;




