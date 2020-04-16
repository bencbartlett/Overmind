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
 */
function packId(id: string): string {
	return String.fromCharCode(parseInt(id.substr(0, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(4, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(8, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(12, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(16, 4), 16)) +
		   String.fromCharCode(parseInt(id.substr(20, 4), 16));
}

/**
 * Convert a compressed six-character UTF-encoded id back into the original 24-character format
 */
function unpackId(packedId: string): string {
	const id = [];
	let current: number;
	for (let i = 0; i < 6; ++i) {
		current = packedId.charCodeAt(i);
		id.push((current >>> 8).toString(16));
		id.push((current & 0xFF).toString(16));
	}
	return id.join('');
}


export function testIdEncoder() {

	const ogStart = Game.cpu.getUsed();

	let start, elapsed: number;

	console.log(`Collecting ids...`);

	start = Game.cpu.getUsed();
	const allIds = [];
	for (const name in Game.creeps) {
		allIds.push(Game.creeps[name].id);
	}
	for (const id in Game.structures) {
		allIds.push(id);
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

	console.log(`Testing id decoding...`);
	start = Game.cpu.getUsed();
	const idsUnpacked = [];
	for (let i = 0, len = idsPacked.length; i < len; ++i) {
		idsUnpacked.push(unpackId(idsPacked[i]));
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

	console.log(`Total time elapsed: ${Game.cpu.getUsed() - ogStart}`);

}





