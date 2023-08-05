// Intra- and inter-tick structure caching, adapted from semperRabbit's IVM module


import {getCacheExpiration, onPublicServer} from '../utilities/utils';

declare global {
	interface Room {
		_storageUnits: StorageUnit[];
		_sources: Source[];
		_mineral: Mineral | undefined;
		_repairables: (Structure | null)[];
		_rechargeables: rechargeObjectType[];
		_walkableRamparts: (StructureRampart | null)[];
		_barriers: (StructureWall | StructureRampart)[] | undefined;
	}
}

const roomStructureIDs: { [roomName: string]: { [structureType: string]: string[] } } = {};
const roomStructuresExpiration: { [roomName: string]: number } = {};

const multipleList = [
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_ROAD, STRUCTURE_WALL,
	STRUCTURE_RAMPART, STRUCTURE_KEEPER_LAIR, STRUCTURE_PORTAL, STRUCTURE_LINK,
	STRUCTURE_TOWER, STRUCTURE_LAB, STRUCTURE_CONTAINER, STRUCTURE_POWER_BANK,
];

const singleList = [
	STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_EXTRACTOR,
	STRUCTURE_NUKER, STRUCTURE_FACTORY, STRUCTURE_INVADER_CORE,
	// STRUCTURE_TERMINAL,   STRUCTURE_CONTROLLER,   STRUCTURE_STORAGE, // These already have room.* shortcuts to them
];

const notRepairable: string[] = [STRUCTURE_KEEPER_LAIR, STRUCTURE_PORTAL, STRUCTURE_POWER_BANK, STRUCTURE_INVADER_CORE];

const STRUCTURE_TIMEOUT = onPublicServer() ? 50 : 10;

Room.prototype._refreshStructureCache = function() {
	// if cache is expired or doesn't exist
	if (!roomStructuresExpiration[this.name]
		|| !roomStructureIDs[this.name]
		|| Game.time > roomStructuresExpiration[this.name]) {
		roomStructuresExpiration[this.name] = getCacheExpiration(STRUCTURE_TIMEOUT);
		roomStructureIDs[this.name] = _.mapValues(_.groupBy(this.find(FIND_STRUCTURES),
															(s: Structure) => s.structureType),
												  (structures: Structure[]) => _.map(structures, s => s.id));
	}
};

multipleList.forEach(function(type) {
	Object.defineProperty(Room.prototype, type + 's', {
		get: function() {
			if (this['_' + type + 's']) {
				return this['_' + type + 's'];
			} else {
				this._refreshStructureCache();
				if (roomStructureIDs[this.name][type]) {
					return this['_' + type + 's'] = _.compact(_.map(roomStructureIDs[this.name][type],
																	Game.getObjectById));
				} else {
					return this['_' + type + 's'] = [];
				}
			}
		},
		configurable: true,
	});
});

singleList.forEach(function(type) {
	Object.defineProperty(Room.prototype, type, {
		get: function() {
			if (this['_' + type]) {
				return this['_' + type];
			} else {
				this._refreshStructureCache();
				if (roomStructureIDs[this.name][type]) {
					return this['_' + type] = Game.getObjectById(roomStructureIDs[this.name][type][0]);
				} else {
					return this['_' + type] = undefined;
				}
			}
		},
		configurable: true,
	});
});


Object.defineProperty(Room.prototype, 'storageUnits', {
	get(this: Room) {
		if (!this._storageUnits) {
			const special: (StorageUnit | undefined)[] = [this.storage, this.terminal];
			this._storageUnits = <StorageUnit[]>_.compact(special).concat(<StorageUnit[]>this.containers);
		}
		return this._storageUnits;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'sources', {
	get(this: Room) {
		if (!this._sources) {
			this._sources = this.find(FIND_SOURCES);
		}
		return this.find(FIND_SOURCES);
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'mineral', {
	get(this: Room) {
		if (!this._mineral) {
			this._mineral = this.find(FIND_MINERALS)[0];
		}
		return this._mineral;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'repairables', {
	get(this: Room) {
		if (!this._repairables) {
			this._refreshStructureCache();
			if (roomStructureIDs[this.name].repairables) {
				return this._repairables = _.compact(_.map(roomStructureIDs[this.name].repairables,
														   o => Game.getObjectById<Structure>(o)));
			} else {
				let repairables: Structure[] = [];
				for (const structureType of singleList) {
					const o = this[structureType];
					if (!o) continue;
					repairables.push(o);
				}
				for (const structureType of multipleList) {
					if (structureType != STRUCTURE_WALL &&
						structureType != STRUCTURE_RAMPART &&
						structureType != STRUCTURE_ROAD &&
						!notRepairable.includes(structureType)) {
						const obj = <{[p: string]: Structure<StructureConstant>[]}><any>this;
						repairables = repairables.concat(obj[structureType + 's']);
					}
				}
				roomStructureIDs[this.name].repairables = _.map(repairables, s => s.id);
				return this._repairables = repairables;
			}
		}
		return this._repairables;
	},
	configurable: true,
});


// TODO: this is expensive and easy to over-use. Perhaps remove this.
Object.defineProperty(Room.prototype, 'walkableRamparts', {
	get(this: Room) {
		if (!this._walkableRamparts) {
			this._refreshStructureCache();
			if (roomStructureIDs[this.name].walkableRamparts) {
				return this._walkableRamparts = _.compact(_.map(roomStructureIDs[this.name].walkableRamparts,
																(o) => Game.getObjectById<StructureRampart>(o)));
			} else {
				const walkableRamparts = _.filter(this.ramparts,
												  (r: StructureRampart) => r.pos.isWalkable(true));
				roomStructureIDs[this.name].walkableRamparts = _.map(walkableRamparts, r => r.id);
				return this._walkableRamparts = walkableRamparts;
			}
		}
		return this._walkableRamparts;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'rechargeables', {
	get(this: Room) {
		if (!this._rechargeables) {
			this._rechargeables = [...this.storageUnits,
								   ...this.droppedEnergy,
								   ...this.tombstones,
								   ...this.ruins];
		}
		return this._rechargeables;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'barriers', {
	get(this: Room) {
		if (!this._barriers) {
			this._barriers = (<(StructureRampart | StructureWall)[]>[]).concat(this.ramparts, this.constructedWalls);
		}
		return this._barriers;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'walls', {
	get(this: Room) {
		return this.constructedWalls;
	},
	configurable: true,
});



