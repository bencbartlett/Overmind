// Room prototypes - commonly used room properties and methods

import {MY_USERNAME} from '../~settings';

// Logging =============================================================================================================
Object.defineProperty(Room.prototype, 'print', {
	get() {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.name + '">' + this.name + '</a>';
	}
});

// Room properties =====================================================================================================

Object.defineProperty(Room.prototype, 'my', {
	get() {
		return this.controller && this.controller.my;
	},
});

Object.defineProperty(Room.prototype, 'reservedByMe', {
	get() {
		return this.controller && this.controller.reservation && this.controller.reservation.username == MY_USERNAME;
	},
});

Object.defineProperty(Room.prototype, 'signedByMe', {
	get() {
		return this.controller && this.controller.sign && this.controller.sign.text == Memory.signature;
	},
});

// Room properties: creeps =============================================================================================

// Creeps physically in the room
Object.defineProperty(Room.prototype, 'creeps', {
	get() {
		if (!this._creeps) {
			this._creeps = this.find(FIND_MY_CREEPS);
		}
		return this._creeps;
	},
});

// Room properties: hostiles ===========================================================================================

// Hostile creeps currently in the room

Object.defineProperty(Room.prototype, 'hostiles', {
	get() {
		if (!this._hostiles) {
			this._hostiles = _.filter(this.find(FIND_HOSTILE_CREEPS),
									  (creep: Creep) => creep.owner.username != 'Source Keeper');
		}
		return this._hostiles;
	}
});

Object.defineProperty(Room.prototype, 'dangerousHostiles', {
	get() {
		if (!this._dangerousHostiles) {
			this._dangerousHostiles = _.filter(this.hostiles,
											   (creep: Creep) => creep.getActiveBodyparts(ATTACK) > 0
																 || creep.getActiveBodyparts(WORK) > 0
																 || creep.getActiveBodyparts(RANGED_ATTACK) > 0
																 || creep.getActiveBodyparts(HEAL) > 0);
		}
		return this._dangerousHostiles;
	}
});

Object.defineProperty(Room.prototype, 'playerHostiles', {
	get() {
		if (!this._playerHostiles) {
			this._playerHostiles = _.filter(this.hostiles, (creep: Creep) => creep.owner.username != 'Invader');
		}
		return this._playerHostiles;
	}
});

Object.defineProperty(Room.prototype, 'dangerousPlayerHostiles', {
	get() {
		if (!this._dangerousPlayerHostiles) {
			this._dangerousPlayerHostiles = _.filter(this.playerHostiles,
													 (c: Creep) => c.getActiveBodyparts(ATTACK) > 0
																   || c.getActiveBodyparts(WORK) > 0
																   || c.getActiveBodyparts(RANGED_ATTACK) > 0
																   || c.getActiveBodyparts(HEAL) > 0);
		}
		return this._dangerousPlayerHOstiles;
	}
});

// Hostile structures currently in the room
Object.defineProperty(Room.prototype, 'hostileStructures', {
	get() {
		if (!this._hostileStructures) {
			this._hostileStructures = this.find(FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hitsMax});
		}
		return this._hostileStructures;
	},
});

// Room properties: flags ==============================================================================================

// Flags physically in this room
Object.defineProperty(Room.prototype, 'flags', {
	get() {
		if (!this._flags) {
			this._flags = this.find(FIND_FLAGS);
		}
		return this._flags;
	},
});

// Room properties: structures =========================================================================================

Object.defineProperty(Room.prototype, 'constructionSites', {
	get() {
		if (!this._constructionSites) {
			this._constructionSites = this.find(FIND_MY_CONSTRUCTION_SITES);
		}
		return this._constructionSites;
	},
});

Object.defineProperty(Room.prototype, 'tombstones', {
	get() {
		if (!this._tombstones) {
			this._tombstones = this.find(FIND_TOMBSTONES);
		}
		return this._tombstones;
	},
});

Object.defineProperty(Room.prototype, 'drops', {
	get() {
		if (!this._drops) {
			this._drops = _.groupBy(this.find(FIND_DROPPED_RESOURCES), (r: Resource) => r.resourceType);
		}
		return this._drops;
	},
});

Object.defineProperty(Room.prototype, 'droppedEnergy', {
	get() {
		return this.drops[RESOURCE_ENERGY] || [];
	},
});

Object.defineProperty(Room.prototype, 'droppedPower', {
	get() {
		return this.drops[RESOURCE_POWER] || [];
	},
});

// Object.defineProperties(Room.prototype, {

// // Spawns in the room
// spawns: {
// 	get() {
// 		return this.structures[STRUCTURE_SPAWN] || [];
// 	},
// },
//
// // All extensions in room
// extensions: {
	// 	get() {
// 		return this.structures[STRUCTURE_EXTENSION] || [];
// 	},
// },
//
// // The extractor in the room, if present
// extractor: {
// 	get() {
// 		return (this.structures[STRUCTURE_EXTRACTOR] || [])[0] || undefined;
// 	},
// },
//
// // All containers in the room
// containers: {
	// 	get() {
// 		return this.structures[STRUCTURE_CONTAINER] || [];
	// 	},
	// },
	//
// // All container-like objects in the room
// storageUnits: {
	// 	get() {
// 		if (!this.structures['storageUnits']) {
// 			let storageUnits = [].concat(this.structures[STRUCTURE_CONTAINER],
// 										 this.structures[STRUCTURE_STORAGE],
// 										 this.structures[STRUCTURE_TERMINAL]);
// 			this.structures['storageUnits'] = _.compact(_.flatten(storageUnits));
// 		}
// 		return this.structures['storageUnits'] || [];
// 	},
// },
//
// // Towers
// towers: {
// 	get() {
// 		return this.structures[STRUCTURE_TOWER] || [];
// 	},
// },
//
// // Links, some of which are assigned to virtual components
// links: {
// 	get() {
// 		return this.structures[STRUCTURE_LINK] || [];
// 	},
// },
//
// // Labs
// labs: {
// 	get() {
// 		return this.structures[STRUCTURE_LAB] || [];
// 	},
// },
//
// // All energy sources
// sources: {
// 	get() {
// 		return this.find(FIND_SOURCES) || [];
// 	},
// },
//
// mineral: {
// 	get() {
// 		return this.find(FIND_MINERALS)[0];
// 	},
// },
//
// keeperLairs: {
// 	get() {
// 		return this.structures[STRUCTURE_KEEPER_LAIR] || [];
// 	},
// },
//
// // All non-barrier, non-road repairable objects
// repairables: {
// 	get() {
// 		if (!this.structures['repairables']) {
// 			let repairables: Structure[] = [];
// 			for (let structureType in this.structures) {
// 				if (structureType != STRUCTURE_WALL &&
// 					structureType != STRUCTURE_RAMPART &&
// 					structureType != STRUCTURE_ROAD) {
// 					repairables = repairables.concat(this.structures[structureType]);
// 				}
// 			}
// 			this.structures['repairables'] = _.compact(_.flatten(repairables));
// 		}
// 		return this.structures['repairables'] || [];
// 	},
// },
//
// // All containers in the room
// roads: {
// 	get() {
// 		return this.structures[STRUCTURE_ROAD] || [];
// 	},
// },
//
// // All construction sites
// constructionSites: {
// 	get() {
// 		return Overmind.cache.constructionSites[this.name] || [];
// 	},
// },
//
// // // All non-road construction sites
// // structureSites: {
// // 	get() {
// // 		return Overmind.cache.structureSites[this.name] || [];
// // 	},
// // },
// //
// // // All construction sites for roads
// // roadSites: {
// // 	get() {
// // 		return Overmind.cache.roadSites[this.name] || [];
// // 	},
// // },
//
// // All walls and ramparts
// barriers: {
// 	get() {
// 		if (!this.structures['barriers']) {
// 			let barriers = [].concat(this.structures[STRUCTURE_WALL],
// 									 this.structures[STRUCTURE_RAMPART]);
// 			this.structures['barriers'] = _.compact(_.flatten(barriers));
// 		}
// 		return this.structures['barriers'] || [];
// 	},
// },
//
// ramparts: {
// 	get() {
// 		return this.structures[STRUCTURE_RAMPART] || [];
	// 	},
	// },
//
// walls: {
// 	get() {
// 		return this.structures[STRUCTURE_WALL] || [];
// 	},
// },
// });


