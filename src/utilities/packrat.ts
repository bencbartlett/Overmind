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
 * Benchmarking: average of 60ns-150ns to execute on shard2 public server
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
 */
export function unpackCoordAsPos(packedCoord: string, roomName: string): RoomPosition {
	const coord = unpackCoord(packedCoord);
	return new RoomPosition(coord.x, coord.y, roomName);
}

/**
 * Unpacks a list of coordinates and creates a list of RoomPositions from a specified roomName
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
 * Benchmarking: average of 100-400ns to execute on shard2 public server, reduce stringified size by 90%
 */
export function packPos(pos: RoomPosition): string {
	return packCoord(pos) + packRoomName(pos.roomName);
}

/**
 * Unpacks a RoomPosition stored as a pair of utf-16 characters.
 *
 * Benchmarking: average of 100-500ns to execute on shard2 public server.
 */
export function unpackPos(chars: string): RoomPosition {
	const {x, y} = unpackCoord(chars[0]);
	return new RoomPosition(x, y, unpackRoomName(chars[1]));
}

/**
 * Packs a list of RoomPositions as a utf-16 string. This is better than having a list of packed RoomPositions, as it
 * avoids extra commas and "" when memroy gets stringified.
 *
 * Benchmarking: average of 100-200ns per position to execute on shard2 public server, reduce stringified size by 95%
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
 * Benchmarking: average of 0.5-1.5us per position to execute on shard2 public server.
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
global.packCoordList = packCoordList;
global.unpackCoordList = unpackCoordList;
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


		let posEqual = true;
		for (let i = 0; i < allCoord.length; i++) {
			if (!(allCoord[i].x == coordUnpacked[i].x && allCoord[i].y == coordUnpacked[i].y)) {
				console.log(`Unpacked pos not equal! orig: ${JSON.stringify(allCoord[i])}; `+
							`unpacked: ${JSON.stringify(coordUnpacked[i])}`);
				posEqual = false;
				break;
			}
			if (!(allCoord[i].x == coordListUnpacked[i].x && allCoord[i].y == coordListUnpacked[i].y)) {
				console.log(`Unpacked pos not equal! orig: ${JSON.stringify(allCoord[i])}; `+
							`unpacked: ${JSON.stringify(coordListUnpacked[i])}`);
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


}




