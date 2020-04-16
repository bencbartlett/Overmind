// All structure prototypes

// General structure prototypes ========================================================================================

import {MY_USERNAME} from '../~settings';

PERMACACHE.structureWalkability = PERMACACHE.structureWalkability || {};
Object.defineProperty(Structure.prototype, 'isWalkable', {
	get() {
		if (PERMACACHE.structureWalkability[this.id] !== undefined) {
			return PERMACACHE.structureWalkability[this.id];
		}
		if (this.structureType === STRUCTURE_RAMPART) {
			return (<StructureRampart>this.my || <StructureRampart>this.isPublic);
		} else {
			PERMACACHE.structureWalkability[this.id] = this.structureType == STRUCTURE_ROAD ||
													   this.structureType == STRUCTURE_CONTAINER ||
													   this.structureType == STRUCTURE_PORTAL;
			return PERMACACHE.structureWalkability[this.id];
		}
	},
	configurable: true,
});

// monkey-patch OwnedStructure.isActive to include some caching since it's actually pretty expensive
// const _OwnedStructureIsActive = OwnedStructure.prototype.isActive;
OwnedStructure.prototype._isActive = OwnedStructure.prototype.isActive;
// OwnedStructure.prototype.isActive = function() {
// 	// Do a quick check to see if the room is owned by same owner of structure and/or if it's RCL 8
// 	if (this.room.controller) {
// 		const thisOwner = this.owner ? this.owner.username : 'noThisOwner';
// 		const controllerOwner = this.room.controller.owner ? this.room.controller.username : 'noControllerOwner';
// 		if (thisOwner != controllerOwner) { // if it's not owned by room owner, it's not active
// 			return false;
// 		}
// 		const level = this.room.controller.level || 0;
// 		if (level == 8) { // everything is active at RCL 8
// 			return true;
// 		}
// 	}
// 	// Otherwise use cached value or call this.inActive()
// 	if (this._isActiveValue == undefined) {
// 		this._isActiveValue = this._isActive();
// 	}
// 	return this._isActiveValue;
// };

// Container prototypes ================================================================================================

Object.defineProperty(StructureContainer.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
	configurable: true,
});

Object.defineProperty(StructureContainer.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
	configurable: true,
});
Object.defineProperty(StructureContainer.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
	configurable: true,
});

// Controller prototypes ===============================================================================================

Object.defineProperty(StructureController.prototype, 'reservedByMe', {
	get         : function() {
		return this.reservation && this.reservation.username == MY_USERNAME;
	},
	configurable: true,
});

Object.defineProperty(StructureController.prototype, 'signedByMe', {
	get         : function() {
		return this.sign && this.sign.username == MY_USERNAME && Game.time - this.sign.time < 250000;
	},
	configurable: true,
});

Object.defineProperty(StructureController.prototype, 'signedByScreeps', {
	get         : function() {
		return this.sign && this.sign.username == 'Screeps';
	},
	configurable: true,
});


StructureController.prototype.needsReserving = function(reserveBuffer: number): boolean {
	return !this.reservation || (this.reservedByMe && this.reservation.ticksToEnd < reserveBuffer);
};

// Extension prototypes ================================================================================================

Object.defineProperty(StructureExtension.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureExtension.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
	configurable: true,
});

// Link prototypes =====================================================================================================

Object.defineProperty(StructureLink.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureLink.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
	configurable: true,
});

Object.defineProperty(StructureLink.prototype, 'storeCapacity', { // forwards-backwards compatibility
	get() {
		return this.energyCapacity;
	},
	configurable: true,
});


// Nuker prototypes ====================================================================================================

// PowerSpawn prototypes ===============================================================================================

// Spawn prototypes ====================================================================================================

Object.defineProperty(StructureSpawn.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureSpawn.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
	configurable: true,
});

// Storage prototypes ==================================================================================================
declare const Store: any; // Store prototype isn't included in typed-screeps yet
Object.defineProperty(Store.prototype, 'contents', {
	get() {
		return Object.entries(this);
	},
	configurable: true,
});

// Storage prototypes ==================================================================================================

Object.defineProperty(StructureStorage.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
	configurable: true,
});

Object.defineProperty(StructureStorage.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureStorage.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
	configurable: true,
});


// Terminal prototypes =================================================================================================

Object.defineProperty(StructureTerminal.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
	configurable: true,
});

Object.defineProperty(StructureTerminal.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureTerminal.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
	configurable: true,
});

Object.defineProperty(StructureTerminal.prototype, 'isReady', { // the terminal is ready to send or deal
	get() {
		return this.cooldown == 0 && !this._notReady;
	},
	configurable: true,
});

Object.defineProperty(StructureTerminal.prototype, 'hasReceived', { // terminal received this tick via send/deal
	get() {
		return this._hasReceived;
	},
	configurable: true,
});

const _terminalSend = StructureTerminal.prototype.send;
StructureTerminal.prototype.send = function(resourceType: ResourceConstant, amount: number, destination: string,
											description?: string): ScreepsReturnCode {
	const response = _terminalSend.call(this, resourceType, amount, destination, description);
	if (response == OK) {
		this._notReady = true;
		if (Game.rooms[destination] && Game.rooms[destination].terminal) {
			(<any>Game.rooms[destination].terminal!)._hasReceived = true;
		}
	}
	return response;
};

// Tower prototypes

Object.defineProperty(StructureTower.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureTower.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
	configurable: true,
});

// Tombstone prototypes ================================================================================================
Object.defineProperty(Tombstone.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
	configurable: true,
});

