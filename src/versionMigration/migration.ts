// // /* Migration file used to migrate versions of the AI between breaking changes */
// //
// // export function migrate() {
// // 	// // Migrate creeps from workRoom to colony format and obtain new task updates
// // 	for (let name in Game.creeps) {
// // 		let creep = Game.creeps[name];
// // 		creep.suicide();
// // 		// creep.memory.task = null;
// // 		// // if (creep.memory.role == 'linker') {
// // 		// // 	creep.suicide();
// // 		// // 	continue;
// // 		// // }
// // 		// creep.memory.colony = creep.room.colony.name;
// // 		// delete creep.memory.workRoom;
// // 	}
// // 	//
// 	for (let name in Game.flags) {
// 		let flag = Game.flags[name];
// 		if (flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_PURPLE) {
//
// 			flag.remove();
// 			flag.memory.colony = flag.memory.assignedRoom;
// 			delete flag.memory.assignedRoom;
// 		}
// 		// delete flag.memory.requiredCreepAmounts;
// 		// delete flag.memory.assignedCreepAmounts;
// 	}
// //
// // 	// let roomColonies: { [roomName: string]: string } = {
// // 	// 	W21N88: 'W21N87',
// // 	// 	W21N86: 'W21N87',
// // 	// 	W22N86: 'W21N87',
// // 	// 	W19N89: 'W19N88',
// // 	// 	W18N89: 'W19N88',
// // 	// 	W19N87: 'W19N88',
// // 	// 	W18N87: 'W17N87',
// // 	// 	W17N88: 'W17N87',
// // 	// 	W17N86: 'W17N87',
// // 	// 	W16N87: 'W17N87',
// // 	// 	W17N89: 'W15N89',
// // 	// 	W16N89: 'W15N89',
// // 	// 	W14N89: 'W15N89',
// // 	// 	W15N88: 'W15N89',
// // 	// 	W16N88: 'W15N89',
// // 	// 	W13N89: 'W14N88',
// // 	// 	W13N88: 'W14N88',
// // 	// 	W13N87: 'W14N87',
// // 	// 	W15N87: 'W14N87',
// // 	// 	W18N86: 'W19N86',
// // 	// 	W19N85: 'W19N86',
// // 	// 	W18N85: 'W19N86',
// // 	// 	W19N84: 'W19N86'
// // 	// };
// // 	//
// // 	// for (let name in Game.rooms) {
// // 	// 	let room = Game.rooms[name];
// // 	// 	room.setColony(roomColonies[name]);
// // 	// }
// // }
// //
