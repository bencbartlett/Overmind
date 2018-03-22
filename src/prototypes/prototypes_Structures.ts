// All structure prototypes

// General structure prototypes ========================================================================================

import {myUsername, signature} from '../settings/settings_user';
import {DirectiveLabMineral} from '../directives/logistics/directive_labMineralType';

Object.defineProperty(StructureContainer.prototype, 'isPassible', {
	get() {
		return this.structureType != STRUCTURE_ROAD &&
			   this.structureType != STRUCTURE_CONTAINER &&
			   !(this.structureType == STRUCTURE_RAMPART && (<StructureRampart>this.my ||
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
		return this.reservation && this.reservation.username == myUsername;
	},
});

Object.defineProperty(StructureController.prototype, 'signedByMe', {
	get: function () {
		return this.sign && this.sign.text == signature;
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
StructureLab.prototype.getMineralType = function (): _ResourceConstantSansEnergy | undefined {
	if (this.mineralType) {
		return this.mineralType;
	} else {
		let flags = this.pos.lookFor(LOOK_FLAGS);
		let dir = _.first(DirectiveLabMineral.find(flags) as DirectiveLabMineral[]);
		if (dir && dir.mineralType) {
			return dir.mineralType;
		}
	}
};

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




