// Room prototypes - commonly used room properties and methods
import {visuals} from '../visuals/visuals';
import {controllerSignature, myUsername} from '../settings/settings_user';

// Room brain ==========================================================================================================
// Object.defineProperty(Room.prototype, 'brain', {
//     get () {
//         return Overmind.RoomBrains[this.name];
//     },
// });

// Colony association ==================================================================================================
Object.defineProperty(Room.prototype, 'colonyFlag', {
	get () {
		return this.find(FIND_FLAGS, flagCodes.territory.colony.filter)[0];
	},
});

Object.defineProperty(Room.prototype, 'colony', { // link to colony object in the overmind
	get () {
		return Overmind.Colonies[this.memory.colony];
	},
});
Room.prototype.setColony = function (colonyName: string) {
	if (!Overmind.Colonies[colonyName]) {
		console.log('Colony does not exist!');
	} else {
		if (this.colonyFlag) {
			this.colonyFlag.remove();
		}
		if (this.controller) {
			this.createFlag(this.controller.pos, this.name + ':' + colonyName, COLOR_PURPLE, COLOR_PURPLE);
		} else {
			this.createFlag(25, 25, this.name + ':' + colonyName, COLOR_PURPLE, COLOR_PURPLE);
		}
		console.log('Room ' + this.name + ' has been assigned to colony ' + colonyName + '.');
	}
};

// Overlord ============================================================================================================
Object.defineProperty(Room.prototype, 'overlord', {
	get () {
		return Overmind.Overlords[this.memory.colony];
	},
});

// Room properties =====================================================================================================

Object.defineProperty(Room.prototype, 'my', {
	get () {
		return this.controller && this.controller.my;
	},
});

Object.defineProperty(Room.prototype, 'reservedByMe', {
	get () {
		return this.controller && this.controller.reservation && this.controller.reservation.username == myUsername;
	},
});

Object.defineProperty(Room.prototype, 'signedByMe', {
	get () {
		return this.controller && this.controller.sign && this.controller.sign.text == controllerSignature;
	},
});

// Room properties: creeps =============================================================================================

// Creeps physically in the room
Object.defineProperty(Room.prototype, 'creeps', {
	get () {
		return this.find(FIND_MY_CREEPS);
	},
});

// Room properties: hostiles ===========================================================================================

// Hostile creeps currently in the room
Object.defineProperty(Room.prototype, 'hostiles', {
	get () {
		return this.find(FIND_HOSTILE_CREEPS);
	},
});

// Hostile structures currently in the room
Object.defineProperty(Room.prototype, 'hostileStructures', {
	get () {
		return this.find(FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits});
	},
});

// Room properties: flags ==============================================================================================

// Flags physically in this room
Object.defineProperty(Room.prototype, 'flags', {
	get () {
		return this.find(FIND_FLAGS);
	},
});

// Flags assigned to this room
Object.defineProperty(Room.prototype, 'assignedFlags', {
	get () {
		return _.filter(Game.flags, flag => flag.memory.assignedRoom && flag.memory.assignedRoom == this.name);
	},
});

// Room properties: structures =========================================================================================

// Total remaining construction progress in this room
Object.defineProperty(Room.prototype, 'remainingConstructionProgress', { // flags assigned to this room
	get () {
		let constructionSites = this.find(FIND_MY_CONSTRUCTION_SITES) as ConstructionSite[];
		if (constructionSites.length == 0) {
			return 0;
		} else {
			return _.sum(_.map(constructionSites, site => site.progressTotal - site.progress));
		}

	},
});


// Cached room properties ==============================================================================================

Object.defineProperty(Room.prototype, 'structures', {
	get () {
		return Game.cache.structures[this.name];
	},
});

Object.defineProperty(Room.prototype, 'drops', {
	get () {
		return Game.cache.drops[this.name];
	},
});

Room.prototype.getStructures = function (structureType: string): Structure[] {
	return this.structures[structureType] || [];
};


Object.defineProperties(Room.prototype, {
	// Dropped resources that are eneryg
	droppedEnergy: {
		get() {
			return this.drops[RESOURCE_ENERGY] || [];
		},
	},

	droppedMinerals: {
		get() {
			let minerals: Resource[] = [];
			for (let resourceType in this.drops) {
				if (resourceType != RESOURCE_ENERGY && resourceType != RESOURCE_POWER) {
					minerals = minerals.concat(this.drops[resourceType]);
				}
			}
			return minerals;
		},
	},

	droppedPower: {
		get() {
			return this.drops[RESOURCE_POWER] || [];
		},
	},

	// Spawns in the room
	spawns: {
		get() {
			return this.structures[STRUCTURE_SPAWN] || [];
		},
	},

	// All extensions in room
	extensions: {
		get() {
			return this.structures[STRUCTURE_EXTENSION] || [];
		},
	},

	// All containers in the room
	containers: {
		get() {
			return this.structures[STRUCTURE_CONTAINER] || [];
		},
	},

	// All container-like objects in the room
	storageUnits: {
		get() {
			if (!this.structures['storageUnits']) {
				let storageUnits = [].concat(this.structures[STRUCTURE_CONTAINER],
											 this.structures[STRUCTURE_STORAGE]);
				this.structures['storageUnits'] = _.compact(_.flatten(storageUnits));
			}
			return this.structures['storageUnits'] || [];
		},
	},

	// Towers
	towers: {
		get() {
			return this.structures[STRUCTURE_TOWER] || [];
		},
	},

	// Links, some of which are assigned to virtual components
	links: {
		get() {
			return this.structures[STRUCTURE_LINK] || [];
		},
	},

	// Labs
	labs: {
		get() {
			return this.structures[STRUCTURE_LAB] || [];
		},
	},

	// All energy sources
	sources: {
		get() {
			return this.find(FIND_SOURCES) || [];
		},
	},

	// All objects requiring a regular supply of energy
	sinks: {
		get() {
			if (!this.structures['sinks']) {
				let sinks = [].concat(this.structures[STRUCTURE_SPAWN],
									  this.structures[STRUCTURE_EXTENSION],
									  this.structures[STRUCTURE_LAB],
									  this.structures[STRUCTURE_TOWER],
									  this.structures[STRUCTURE_POWER_SPAWN]);
				this.structures['sinks'] = _.compact(_.flatten(sinks));
			}
			return this.structures['sinks'] || [];
		},
	},

	// All non-barrier repairable objects
	repairables: {
		get() {
			if (!this.structures['repairables']) {
				let repairables: Structure[] = [];
				for (let structureType in this.structures) {
					if (structureType != STRUCTURE_WALL && structureType != STRUCTURE_RAMPART) {
						repairables = repairables.concat(this.structures[structureType]);
					}
				}
				this.structures['repairables'] = _.compact(_.flatten(repairables));
			}
			return this.structures['repairables'] || [];
		},
	},

	// All construction sites
	constructionSites: {
		get() {
			if (!Game.cache.constructionSites[this.name]) {
				Game.cache.constructionSites[this.name] = this.find(FIND_CONSTRUCTION_SITES);
			}
			return Game.cache.constructionSites[this.name] || [];
		},
	},

	// All non-road construction sites
	structureSites: {
		get() {
			return _.filter(this.constructionSites,
							(c: ConstructionSite) => c.structureType != STRUCTURE_ROAD) || [];
		},
	},

	// All construction sites for roads
	roadSites: {
		get() {
			return _.filter(this.constructionSites,
							(c: ConstructionSite) => c.structureType == STRUCTURE_ROAD) || [];
		},
	},

	// All walls and ramparts
	barriers: {
		get() {
			if (!this.structures['barriers']) {
				let barriers = [].concat(this.structures[STRUCTURE_WALL],
										 this.structures[STRUCTURE_RAMPART]);
				this.structures['barriers'] = _.compact(_.flatten(barriers));
			}
			return this.structures['barriers'] || [];
		},
	},

	// Remote containers TODO: deprecated soon
	remoteContainers: {
		get() {
			let miningFlags = _.filter(this.assignedFlags, flagCodes.industry.remoteMine.filter) as Flag[];
			var containers: Container[] = [];
			for (let flag of miningFlags) {
				if (flag.room == undefined) { // need vision of container
					continue;
				}
				let nearbyContainers = flag.pos.findInRange(FIND_STRUCTURES, 2, {
					filter: (s: Structure) => s.structureType == STRUCTURE_CONTAINER,
				}) as Container[];
				containers = containers.concat(nearbyContainers);
			}
			return _.compact(_.flatten(containers)) || [];
		},
	},

	// All containers marked for refill TODO: deprecate soon
	sinkContainers: {
		get() {
			return _.filter(this.containers, (s: Container) => s.refillThis);
		},
	},

	// All links marked for refill TODO: deprecate soon
	sinkLinks: {
		get() {
			return _.filter(this.links, (s: Link) => s.refillThis);
		},
	},
});


// Run function for room. Executed before roomBrain.run.
Room.prototype.run = function () {
	// Animate each tower: see prototypes_StructureTower
	for (let tower of this.towers) {
		tower.run();
	}
	// // Animate each link: transfer to storage when it is >50% full if storage link is empty and cooldown is over
	// var refillLinks = _.filter(this.links, (s: Link) => s.refillThis && s.energy <= 0.5 * s.energyCapacity);
	// if (this.links.length > 0) {
	// 	var targetLink;
	// 	if (refillLinks.length > 0) {
	// 		targetLink = refillLinks[0];
	// 	} else {
	// 		targetLink = this.storage.links[0];
	// 	}
	// 	for (let link of this.links) {
	// 		if (link != targetLink) {
	// 			if (link.energy > 0.85 * link.energyCapacity && !link.refillThis && link.cooldown == 0) {
	// 				link.transferEnergy(targetLink);
	// 			}
	// 		}
	// 	}
	// }
	// Draw all visuals
	// visuals.drawRoomVisuals(this);
};

