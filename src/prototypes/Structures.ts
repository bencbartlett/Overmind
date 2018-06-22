// All structure prototypes

// General structure prototypes ========================================================================================

import {MY_USERNAME} from '../~settings';

Object.defineProperty(Structure.prototype, 'isWalkable', {
	get() {
		return this.structureType == STRUCTURE_ROAD ||
			   this.structureType == STRUCTURE_CONTAINER ||
			   (this.structureType == STRUCTURE_RAMPART && (<StructureRampart>this.my ||
															<StructureRampart>this.isPublic));
	},
});

// Container prototypes ================================================================================================

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

// Controller prototypes ===============================================================================================

Object.defineProperty(StructureController.prototype, 'reservedByMe', {
	get: function () {
		return this.reservation && this.reservation.username == MY_USERNAME;
	},
});

Object.defineProperty(StructureController.prototype, 'signedByMe', {
	get: function () {
		return this.sign && this.sign.text == Memory.signature && Game.time - this.sign.time < 250000;
	},
});

Object.defineProperty(StructureController.prototype, 'signedByScreeps', {
	get: function () {
		return this.sign && this.sign.username == 'Screeps';
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

// StructureTerminal.prototype._send = StructureTerminal.prototype.send;
// StructureTerminal.prototype.send = function(resourceType: ResourceConstant, amount: number, destination: string,
// 											description?: string): ScreepsReturnCode {
// 	// Log stats
// 	let origin = this.room.name;
// 	let response = this._send(resourceType, amount, destination, description);
// 	if (response == OK) {
// 		TerminalNetwork.logTransfer(resourceType,amount,origin, destination)
// 	}
// 	return response;
// };

// Tower prototypes

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

// Tombstone prototypes ================================================================================================
Object.defineProperty(Tombstone.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
});

