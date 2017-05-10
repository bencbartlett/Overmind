// Room prototypes - commonly used room properties and methods
import {visuals} from "../visuals/visuals";
import {Task} from "../tasks/Task";

// Room brain ==========================================================================================================
Object.defineProperty(Room.prototype, 'brain', {
    get () {
        return Overmind.RoomBrains[this.name];
    },
});

// Colony association ==================================================================================================
Object.defineProperty(Room.prototype, 'colonyFlag', {
    get () {
        return this.find(FIND_FLAGS, flagCodes.territory.colony.filter);
    },
});

Object.defineProperty(Room.prototype, 'colony', { // link to colony object in the overmind
    get () {
        return Overmind.Colonies[this.memory.colony];
    },
});

// Overlord ============================================================================================================

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

// Tasks of creeps assigned to the room
Object.defineProperty(Room.prototype, 'tasks', {
    get () {
        let tasks = this.assignedCreepNames.map((name: string) => Game.creeps[name].task);
        return _.filter(tasks, task => task != null);
    },
});

// Targets of tasks of creeps assigned to the room
Object.defineProperty(Room.prototype, 'taskTargets', {
    get () {
        let targets = this.tasks.map((task: Task) => task.target);
        return _.filter(targets, target => target != null);
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

Room.prototype.fullestContainer = function () {
    // Set target to the fullest container in the room
    var containers = this.find(FIND_STRUCTURES, {
        filter: (s: StructureContainer) => s.structureType == STRUCTURE_CONTAINER &&
                                           s.store[RESOURCE_ENERGY] > 0,
    });
    if (containers.length > 0) { // loop through results to find the container with the most energy in the room
        var target = containers[0];
        var maxFullness = 0;
        for (let i in containers) {
            if (containers[i].store[RESOURCE_ENERGY] > maxFullness) {
                target = containers[i];
                maxFullness = containers[i].store[RESOURCE_ENERGY];
            }
        }
        return target;
    } else {
        return null;
    }
};

// Cached room properties ==============================================================================================

Object.defineProperty(Room.prototype, 'structures', {
    get () {
        return Game.cache.structures[this.name];
    },
});


Object.defineProperties(Room.prototype, {
    'spawns': { // containers in the room
        get() {
            return this.structures[STRUCTURE_SPAWN];
        },
    },
    'extensions': { // containers in the room
        get() {
            return this.structures[STRUCTURE_EXTENSION];
        },
    },
    'containers': { // containers in the room
        get() {
            return this.structures[STRUCTURE_CONTAINER];
        },
    },
    'storageUnits': { // containers + storage
        get() {
            if (!this.structures['storageUnits']) {
                let storageUnits = [].concat(this.structures[STRUCTURE_CONTAINER],
                                             this.structures[STRUCTURE_STORAGE]);
                this.structures['storageUnits'] = storageUnits;
            }
            return this.structures['storageUnits'];
        },
    },
    'towers': { // towers
        get() {
            return this.structures[STRUCTURE_TOWER];
        },
    },
    'labs': { // labs
        get() {
            return this.structures[STRUCTURE_LAB];
        },
    },
    'sources': { // sources
        get() {
            return this.find(FIND_SOURCES);
        },
    },
    'sinks': { // anything requiring a regular supply of energy
        get() {
            if (!this.structures['sinks']) {
                let sinks = [].concat(this.structures[STRUCTURE_SPAWN],
                                      this.structures[STRUCTURE_EXTENSION],
                                      this.structures[STRUCTURE_LAB],
                                      this.structures[STRUCTURE_TOWER],
                                      this.structures[STRUCTURE_POWER_SPAWN]);
                this.structures['sinks'] = sinks;
            }
            return this.structures['sinks'];
        },
    },
    'repairables': { // anything that can be repaired, excluding walls+ramparts, which are "fortified"
        get() {
            if (!this.structures['repairables']) {
                let repairables: Structure[] = [];
                for (let structureType in this.structures) {
                    if (structureType != STRUCTURE_WALL && structureType != STRUCTURE_RAMPART) {
                        repairables = repairables.concat(this.structures[structureType]);
                    }
                }
                this.structures['repairables'] = repairables;
            }
            return this.structures['repairables'];
        },
    },
    'constructionSites': { // all construction sites; always recached
        get() {
            if (!Game.cache.constructionSites[this.name]) {
                Game.cache.constructionSites[this.name] = this.find(FIND_CONSTRUCTION_SITES);
            }
            return Game.cache.constructionSites[this.name];
        },
    },
    'structureSites': { // construction sites that aren't roads
        get() {
            return _.filter(this.constructionSites[this.name],
                            (c: ConstructionSite) => c.structureType != STRUCTURE_ROAD);
        },
    },
    'roadSites': { // construction sites for roads
        get() {
            return _.filter(this.constructionSites[this.name],
                            (c: ConstructionSite) => c.structureType == STRUCTURE_ROAD);
        },
    },
    'barriers': { // walls and ramparts
        get() {
            if (!this.structures['barriers']) {
                let barriers = [].concat(this.structures[STRUCTURE_WALL],
                                         this.structures[STRUCTURE_RAMPART]);
                this.structures['barriers'] = barriers;
            }
            return this.structures['barriers'];
        },
    },
    'remoteContainers': { // containers in other rooms
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
            return containers;
        },
    },
});


// Run function for room. Executed before roomBrain.run.
Room.prototype.run = function () {
    // Animate each tower: see prototypes_StructureTower
    var towers = this.find(FIND_MY_STRUCTURES, {filter: (s: Structure) => s.structureType == STRUCTURE_TOWER});
    for (let tower of towers) {
        tower.run();
    }
    // Animate each link: transfer to storage when it is >50% full if storage link is empty and cooldown is over
    var links = this.find(FIND_MY_STRUCTURES, {
        filter: (s: Structure) => s.structureType == STRUCTURE_LINK,
    }) as Link[];
    var refillLinks = _.filter(links, s => s.refillThis && s.energy <= 0.5 * s.energyCapacity);
    if (links.length > 0) {
        var targetLink;
        if (refillLinks.length > 0) {
            targetLink = refillLinks[0];
        } else {
            targetLink = this.storage.links[0];
        }
        for (let link of links) {
            if (link != targetLink) {
                if (link.energy > 0.85 * link.energyCapacity && !link.refillThis && link.cooldown == 0) {
                    link.transferEnergy(targetLink);
                }
            }
        }
    }
    // Draw all visuals
    visuals.drawRoomVisuals(this);
};