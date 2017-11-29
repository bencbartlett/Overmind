// var roles = require('roles.js');
// import {GuardSetup} from '../roles/guard';
// import {DestroyerSetup} from '../roles/destroyer';
// import {SiegerSetup} from '../roles/sieger';

export var millitaryFlagActions = {
	// guard: function (flag: Flag): void {
	// 	// Find all idle guards and assign them to this flag
	// 	console.log(flag.name, flag.pos, flag.roomName, flag.colony);
	// 	let idleGuards = _.filter(flag.colony.getCreepsByRole('guard'), (guard: ICreep) => !guard.assignment);
	// 	for (let guard of idleGuards) {
	// 		guard.assignment = flag;
	// 	}
	// 	let assignedGuards = flag.getAssignedCreeps('guard');
	// 	// If there are no hostiles left in the room, remove the flag
	// 	if (flag.room && flag.room.hostiles.length == 0 && flag.room.hostileStructures.length == 0) {
	// 		for (let guard of assignedGuards) {
	// 			guard.assignment = null;
	// 		}
	// 		flag.remove();
	// 		return;
	// 	}
	// 	// If there are insufficient guards assigned, spawn more
	// 	// TODO: figure out how many guards are needed
	// 	if (assignedGuards.length < 1 && flag.colony.hatchery) {
	// 		flag.colony.hatchery.enqueue(
	// 			new GuardSetup().create(flag.colony, {
	// 				assignment            : this,
	// 				patternRepetitionLimit: 3,
	// 			}));
	// 	}
	// },
	//
	// destroyer: function (flag: Flag): void {
	// 	function handleDestroyers(flag: Flag): void {
	// 		var role = new DestroyerSetup();
	// 		if (flag.memory.amount) {
	// 			flag.requiredCreepAmounts[role.name] = flag.memory.amount;
	// 		} else {
	// 			flag.requiredCreepAmounts[role.name] = 1;
	// 		}
	// 		let maxSize = Infinity;
	// 		if (flag.memory.maxSize) {
	// 			maxSize = flag.memory.maxSize;
	// 		}
	// 		flag.requestCreepIfNeeded(role, {patternRepetitionLimit: maxSize});
	// 	}
	//
	// 	handleDestroyers(flag);
	// },
	//
	//
	// sieger: function (flag: Flag): void {
	// 	function handleSiegers(flag: Flag): void {
	// 		var role = new SiegerSetup();
	// 		if (flag.memory.amount) {
	// 			flag.requiredCreepAmounts[role.name] = flag.memory.amount;
	// 		} else {
	// 			flag.requiredCreepAmounts[role.name] = 1;
	// 		}
	// 		let maxSize = Infinity;
	// 		if (flag.memory.maxSize) {
	// 			maxSize = flag.memory.maxSize;
	// 		}
	// 		flag.requestCreepIfNeeded(role, {patternRepetitionLimit: maxSize});
	// 	}
	//
	// 	handleSiegers(flag);
	// },
};

