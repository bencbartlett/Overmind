Object.defineProperty(PowerCreep.prototype, 'inRampart', {
	get() {
		return !!this.pos.lookForStructure(STRUCTURE_RAMPART); // this assumes hostile creeps can't stand in my ramparts
	},
	configurable: true,
});


// // Redefine some properties that creeps have so that PowerCreeps can be inserted in Zerg subclass
//
// Object.defineProperty(PowerCreep.prototype, 'body', {
// 	get() {
// 		return [];
// 	},
// 	configurable: true,
// });
//
// Object.defineProperty(PowerCreep.prototype, 'fatigue', {
// 	get() {
// 		return 0;
// 	},
// 	configurable: true,
// });
//
// Object.defineProperty(PowerCreep.prototype, 'spawning', {
// 	get() {
// 		return false;
// 	},
// 	configurable: true,
// });
//
// PowerCreep.prototype.attack = function(target: AnyCreep | Structure): CreepActionReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.attackController = function(target: StructureController): CreepActionReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.attackController = function(target: StructureController): CreepActionReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.build = function(target: ConstructionSite):
// 	CreepActionReturnCode | ERR_NOT_ENOUGH_RESOURCES | ERR_RCL_NOT_ENOUGH {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.claimController = function(target: StructureController): CreepActionReturnCode
// 	| ERR_FULL | ERR_GCL_NOT_ENOUGH {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.generateSafeMode = function(target: StructureController): CreepActionReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.getActiveBodyparts = function(type: BodyPartConstant): number {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return 0;
// };
// PowerCreep.prototype.harvest = function(target: Source | Mineral | Deposit): CreepActionReturnCode
// 	| ERR_NOT_FOUND | ERR_NOT_ENOUGH_RESOURCES {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.heal = function(target: AnyCreep): CreepActionReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.pull = function(target: Creep): OK | ERR_NOT_OWNER | ERR_BUSY | ERR_INVALID_TARGET
// 	| ERR_NOT_IN_RANGE | ERR_NO_BODYPART {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.rangedAttack = function(target: AnyCreep | Structure): CreepActionReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.rangedHeal = function(target: AnyCreep): CreepActionReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.rangedMassAttack = function(): OK | ERR_NOT_OWNER | ERR_BUSY | ERR_NO_BODYPART {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.repair = function(target: Structure): CreepActionReturnCode | ERR_NOT_ENOUGH_RESOURCES {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.reserveController = function(target: StructureController): CreepActionReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
// PowerCreep.prototype.signController = function(target: StructureController, text: string): OK | ERR_BUSY
// 	| ERR_INVALID_TARGET | ERR_NOT_IN_RANGE {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_INVALID_TARGET;
// };
// PowerCreep.prototype.upgradeController = function(target: StructureController): ScreepsReturnCode {
// 	console.log(`Invalid call to fake method for PowerCreep ${this.name}`);
// 	return ERR_NO_BODYPART;
// };
