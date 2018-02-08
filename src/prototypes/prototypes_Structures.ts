// All structure prototypes

// General structure prototypes ========================================================================================

Object.defineProperty(StructureContainer.prototype, 'isPassible', {
	get() {
		return this.structureType != STRUCTURE_ROAD &&
			   this.structureType != STRUCTURE_CONTAINER &&
			   !(this.structureType == STRUCTURE_RAMPART && (<StructureRampart>this.my ||
															 <StructureRampart>this.isPublic));
	},
});

// Container prototypes ================================================================================================

import {controllerSignature, myUsername} from '../settings/settings_user';

Object.defineProperty(StructureContainer.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
});

Object.defineProperty(StructureContainer.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
});
Object.defineProperty(StructureContainer.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
});

// Estimated amount of energy a hauler leaving storage now would see when it gets to the container
Object.defineProperty(StructureContainer.prototype, 'predictedEnergyOnArrival', {
	get: function () {
		let predictedEnergy = this.energy;
		let targetingCreeps = _.map(this.targetedBy, (name: string) => Game.creeps[name]);
		for (let creep of targetingCreeps) {
			predictedEnergy -= creep.carryCapacity;
		}
		predictedEnergy += (3000 / 300) * this.miningFlag.pathLengthToAssignedRoomStorage;
		return predictedEnergy;
	},
});

// Controller prototypes ===============================================================================================

Object.defineProperty(StructureController.prototype, 'reservedByMe', {
	get: function () {
		return this.reservation && this.reservation.username == myUsername;
	},
});

Object.defineProperty(StructureController.prototype, 'signedByMe', {
	get: function () {
		return this.sign && this.sign.text == controllerSignature;
	},
});

StructureController.prototype.needsReserving = function (reserveBuffer: number): boolean {
	return !this.reservation || (this.reservedByMe && this.reservation.ticksToEnd < reserveBuffer);
};

// Extension prototypes ================================================================================================

Object.defineProperty(StructureExtension.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
});

Object.defineProperty(StructureExtension.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
});

// Lab prototypes ======================================================================================================


// Link prototypes =====================================================================================================

Object.defineProperty(StructureLink.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
});

Object.defineProperty(StructureLink.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
});


// Nuker prototypes ====================================================================================================

// PowerSpawn prototypes ===============================================================================================

// Spawn prototypes ====================================================================================================

Object.defineProperty(StructureSpawn.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
});

Object.defineProperty(StructureSpawn.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
});


// Storage prototypes ==================================================================================================

// StructureStorage.prototype.creepCanWithdrawEnergy = function (creep: Zerg): boolean {
// 	let bufferAmount: number = this.room.colony.overseer.settings.storageBuffer[creep.roleName];
// 	if (!bufferAmount) {
// 		bufferAmount = 0;
// 	}
// 	return this.energy > bufferAmount;
// };

Object.defineProperty(StructureStorage.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
});

Object.defineProperty(StructureStorage.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
});

Object.defineProperty(StructureStorage.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
});


// Terminal prototypes =================================================================================================

Object.defineProperty(StructureTerminal.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
});

Object.defineProperty(StructureTerminal.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
});

Object.defineProperty(StructureTerminal.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
});

// Tower prototypes ====================================================================================================

StructureTower.prototype.run = function () {
	// Task priority for towers: attack, then heal, then repair
	var taskPriority = [
		() => this.attackNearestEnemy(),
		() => this.healNearestAlly(),
		() => this.preventRampartDecay(),
		() => this.repairNearestStructure(),
	];
	for (let task of taskPriority) {
		if (task() == OK) {
			break;
		}
	}
};

StructureTower.prototype.attackNearestEnemy = function () {
	var closestHostile = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
	if (closestHostile != undefined) {
		return this.attack(closestHostile);
	}
};

StructureTower.prototype.healNearestAlly = function () {
	var closestDamagedAlly = this.pos.findClosestByRange(FIND_MY_CREEPS, {
		filter: (c: Creep) => c.hits < c.hitsMax,
	});
	if (closestDamagedAlly) {
		return this.heal(closestDamagedAlly);
	}
};

StructureTower.prototype.repairNearestStructure = function () {
	let toggle = false;
	if (toggle) {
		var closestDamagedStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {
			filter: (s: Structure) => s.hits < s.hitsMax &&
									  s.structureType != STRUCTURE_WALL &&
									  s.structureType != STRUCTURE_RAMPART,
		});
		if (closestDamagedStructure) {
			return this.repair(closestDamagedStructure);
		}
	}
};

StructureTower.prototype.preventRampartDecay = function () {
	let hp = 500; // TODO: hardwired
	var closestDyingRampart = this.pos.findClosestByRange(FIND_STRUCTURES, {
		filter: (s: Structure) => s.hits < hp && s.structureType == STRUCTURE_RAMPART,
	});
	if (closestDyingRampart) {
		return this.repair(closestDyingRampart);
	}
};

Object.defineProperty(StructureTower.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
});

Object.defineProperty(StructureTower.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
});


