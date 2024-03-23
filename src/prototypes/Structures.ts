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

// Storage prototypes ================================================================================================

const StorageLikeStructures = [
	StructureContainer,
	StructureExtension,
	StructureLink,
	StructureStorage,
	StructureTerminal,
	StructureSpawn,
	Tombstone,
	Ruin,
];

for (const structure of StorageLikeStructures) {
	if (!structure.prototype.hasOwnProperty('energy')) {
		Object.defineProperty(structure.prototype, 'energy', {
			get(this: typeof structure.prototype) {
				return this.store.getUsedCapacity(RESOURCE_ENERGY);
			},
			configurable: true,
		});
	}

	Object.defineProperty(structure.prototype, 'isFull', { // if this container-like object is full
		get(this: typeof structure.prototype) {
			return this.store.getFreeCapacity() === 0;
		},
		configurable: true,
	});

	Object.defineProperty(structure.prototype, 'isEmpty', { // if this container-like object is empty
		get(this: StructureContainer) {
			return this.store.getUsedCapacity() === 0;
		},
		configurable: true,
	});
}

// Link prototypes =====================================================================================================

// Controller prototypes ===============================================================================================

Object.defineProperty(StructureController.prototype, 'reservedByMe', {
	get(this: StructureController) {
		return this.reservation && this.reservation.username == MY_USERNAME;
	},
	configurable: true,
});

Object.defineProperty(StructureController.prototype, 'signedByMe', {
	get(this: StructureController) {
		return this.sign && this.sign.username == MY_USERNAME && Game.time - this.sign.time < 250000;
	},
	configurable: true,
});

Object.defineProperty(StructureController.prototype, 'signedByScreeps', {
	get(this: StructureController) {
		return this.sign && this.sign.username == 'Screeps';
	},
	configurable: true,
});


StructureController.prototype.needsReserving = function(reserveBuffer: number): boolean {
	return !this.reservation || (this.reservedByMe && this.reservation.ticksToEnd < reserveBuffer);
};

// Extension prototypes ================================================================================================

// Link prototypes =====================================================================================================

// Nuker prototypes ====================================================================================================

// PowerSpawn prototypes ===============================================================================================

// Spawn prototypes ====================================================================================================

// Storage prototypes ==================================================================================================

declare const Store: any; // Store prototype isn't included in typed-screeps yet
Object.defineProperty(Store.prototype, 'contents', {
	get(this: StoreDefinition) {
		return <StoreContentsArray>Object.entries(this);
	},
	configurable: true,
});

// Storage prototypes ==================================================================================================

// Terminal prototypes =================================================================================================

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
