// All structure prototypes

// Container prototypes ================================================================================================

import {controllerSignature, myUsername} from '../settings/settings_user';
Object.defineProperty(StructureContainer.prototype, 'energy', {
	get () {
		return this.store[RESOURCE_ENERGY];
	},
});

Object.defineProperty(StructureContainer.prototype, 'isFull', { // if this container-like object is full
	get () {
		return _.sum(this.store) >= this.storeCapacity;
	},
});
Object.defineProperty(StructureContainer.prototype, 'isEmpty', { // if this container-like object is empty
	get () {
		return _.sum(this.store) == 0;
	},
});

Object.defineProperty(StructureContainer.prototype, 'refillThis', { // should the lab be loaded or unloaded?
	get () {
		return _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.industry.refillThis.filter).length > 0;
	},
});

Object.defineProperty(StructureContainer.prototype, 'miningFlag', {
	get: function () {
		return this.pos.findInRange(FIND_FLAGS, 2, {
			filter: flagCodes.industry.remoteMine.filter,
		})[0];
	},
});

Object.defineProperty(StructureContainer.prototype, 'miningSite', {
	get: function () {
		let source = this.pos.findInRange(FIND_SOURCES, 2)[0];
		return this.room.colony.miningSites[source.ref];
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

// Extension prototypes ================================================================================================

Object.defineProperty(StructureExtension.prototype, 'isFull', { // if this container-like object is full
	get () {
		return this.energy >= this.energyCapacity;
	},
});

Object.defineProperty(StructureExtension.prototype, 'isEmpty', { // if this container-like object is empty
	get () {
		return this.energy == 0;
	},
});

// Lab prototypes ======================================================================================================

Object.defineProperty(StructureLab.prototype, 'assignedMineralType', {
	get () {
		let flag = _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.minerals.filter)[0] as Flag;
		if (flag) {
			let mineralType = flag.memory.mineralType;
			if (mineralType) {
				return mineralType;
			}
		}
		return null;
	},
});

Object.defineProperty(StructureLab.prototype, 'IO', { // should the lab be loaded or unloaded?
	get () {
		let flag = _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.minerals.filter)[0] as Flag;
		if (flag) {
			return flag.memory.IO;
		}
		return null;
	},
});

Object.defineProperty(StructureLab.prototype, 'maxAmount', { // should the lab be loaded or unloaded?
	get () {
		let flag = _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.minerals.filter)[0] as Flag;
		if (flag) {
			return flag.memory.maxAmount || this.mineralCapacity;
		}
		return null;
	},
});

// Object.defineProperty(StructureLab.prototype, 'isFull', { // if this container-like object is full
// 	get () {
// 		return this.mineralAmount >= this.mineralCapacity;
// 	},
// });
// Object.defineProperty(StructureLab.prototype, 'isEmpty', { // if this container-like object is empty
// 	get () {
// 		return this.mineralAmount == 0;
// 	},
// });


// Link prototypes =====================================================================================================

Object.defineProperty(StructureLink.prototype, 'refillThis', { // should the lab be loaded or unloaded?
	get () {
		return _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.industry.refillThis.filter).length > 0;
	},
});

Object.defineProperty(StructureLink.prototype, 'isFull', { // if this container-like object is full
	get () {
		return this.energy >= this.energyCapacity;
	},
});

Object.defineProperty(StructureLink.prototype, 'isEmpty', { // if this container-like object is empty
	get () {
		return this.energy == 0;
	},
});


// Nuker prototypes ====================================================================================================

// Object.defineProperty(StructureNuker.prototype, 'isFull', { // if this container-like object is full
// 	get () {
// 		return this.energy >= this.energyCapacity;
// 	},
// });
//
// Object.defineProperty(StructureNuker.prototype, 'isEmpty', { // if this container-like object is empty
// 	get () {
// 		return this.energy == 0;
// 	},
// });

// PowerSpawn prototypes ===============================================================================================

// Object.defineProperty(StructurePowerSpawn.prototype, 'isFull', { // if this container-like object is full
// 	get () {
// 		return this.energy >= this.energyCapacity;
// 	},
// });
//
// Object.defineProperty(StructurePowerSpawn.prototype, 'isEmpty', { // if this container-like object is empty
// 	get () {
// 		return this.energy == 0;
// 	},
// });

// Spawn prototypes ====================================================================================================

Object.defineProperty(StructureSpawn.prototype, 'uptime', {
	get () {
		if (Memory.stats && Memory.stats.spawnUsage && Memory.stats.spawnUsage[this.name]) {
			let workingTicks = _.filter(Memory.stats.spawnUsage[this.name], entry => entry != '0').length;
			return workingTicks / Memory.stats.spawnUsage[this.name].length;
		} else {
			console.log(this.name + ': error accessing spawn usage in Memory!');
			return null;
		}
	},
});

Object.defineProperty(StructureSpawn.prototype, 'statusMessage', {
	get () {
		if (this.spawning) {
			let spawning = this.spawning;
			let percent = Math.round(100 * (spawning.needTime - spawning.remainingTime) / spawning.needTime);
			let message = spawning.name + ': ' + Game.icreeps[spawning.name].assignment.pos.roomName +
						  ' (' + percent + '%)';
			return message;
		} else {
			if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
				return 'reloading';
			} else {
				return 'idle';
			}
		}
	},
});

Object.defineProperty(StructureSpawn.prototype, 'isFull', { // if this container-like object is full
	get () {
		return this.energy >= this.energyCapacity;
	},
});

Object.defineProperty(StructureSpawn.prototype, 'isEmpty', { // if this container-like object is empty
	get () {
		return this.energy == 0;
	},
});


// Storage prototypes ==================================================================================================

StructureStorage.prototype.creepCanWithdrawEnergy = function (creep: ICreep): boolean {
	let bufferAmount: number = this.room.colony.overlord.settings.storageBuffer[creep.roleName];
	if (!bufferAmount) {
		bufferAmount = 0;
	}
	return this.energy > bufferAmount;
};

Object.defineProperty(StructureStorage.prototype, 'energy', {
	get () {
		return this.store[RESOURCE_ENERGY];
	},
});

Object.defineProperty(StructureStorage.prototype, 'isFull', { // if this container-like object is full
	get () {
		return _.sum(this.store) >= this.storeCapacity;
	},
});

Object.defineProperty(StructureStorage.prototype, 'isEmpty', { // if this container-like object is empty
	get () {
		return _.sum(this.store) == 0;
	},
});


// Terminal prototypes =================================================================================================

Object.defineProperty(StructureTerminal.prototype, 'energy', {
	get () {
		return this.store[RESOURCE_ENERGY];
	},
});

// Object.defineProperty(StructureTerminal.prototype, 'brain', {
// 	get () {
// 		//noinspection NodeModulesDependencies
// 		return Overmind.TerminalBrains[this.room.name];
// 	},
// });

Object.defineProperty(StructureTerminal.prototype, 'isFull', { // if this container-like object is full
	get () {
		return _.sum(this.store) >= this.storeCapacity;
	},
});

Object.defineProperty(StructureTerminal.prototype, 'isEmpty', { // if this container-like object is empty
	get () {
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
	get () {
		return this.energy >= this.energyCapacity;
	},
});

Object.defineProperty(StructureTower.prototype, 'isEmpty', { // if this container-like object is empty
	get () {
		return this.energy == 0;
	},
});


