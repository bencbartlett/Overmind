// Room prototypes - commonly used room properties and methods
var flagCodes = require('map_flag_codes');

// Room brain ==========================================================================================================

Object.defineProperty(Room.prototype, 'brain', {
    get () {
        return Overmind.RoomBrains[this.name];
    }
});

// Room properties =====================================================================================================

Object.defineProperty(Room.prototype, 'my', {
    get () {
        return this.controller && this.controller.my;
    }
});

Object.defineProperty(Room.prototype, 'reservedByMe', {
    get () {
        return this.controller && this.controller.reservation && this.controller.reservation.username == myUsername;
    }
});

Object.defineProperty(Room.prototype, 'signedByMe', {
    get () {
        return this.controller && this.controller.sign && this.controller.sign.text == controllerSignature;
    }
});

// Room properties: creeps =============================================================================================

// Spawns in the room
Object.defineProperty(Room.prototype, 'spawns', {
    get () {
        return this.find(FIND_MY_SPAWNS);
    }
});

// Creeps physically in the room
Object.defineProperty(Room.prototype, 'creeps', {
    get () {
        return this.find(FIND_MY_CREEPS);
    }
});

// Creeps assigned to the room
Object.defineProperty(Room.prototype, 'assignedCreeps', {
    get () {
        return _.filter(Game.creeps, creep => creep.workRoom == this); // TODO: costly
    }
});

// Tasks of creeps assigned to the room
Object.defineProperty(Room.prototype, 'tasks', {
    get () {
        let tasks = this.assignedCreepNames.map(name => Game.creeps[name].task);
        return _.filter(tasks, task => task != null);
    }
});

// Targets of tasks of creeps assigned to the room
Object.defineProperty(Room.prototype, 'taskTargets', {
    get () {
        let targets = this.tasks.map(task => task.target);
        return _.filter(targets, target => target != null);
    }
});

// Room properties: hostiles ===========================================================================================

// Hostile creeps currently in the room
Object.defineProperty(Room.prototype, 'hostiles', {
    get () {
        return this.find(FIND_HOSTILE_CREEPS);
    }
});

// Hostile structures currently in the room
Object.defineProperty(Room.prototype, 'hostileStructures', {
    get () {
        return this.find(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits});
    }
});

// Room properties: flags ==============================================================================================

// Flags physically in this room
Object.defineProperty(Room.prototype, 'flags', {
    get () {
        return this.find(FIND_FLAGS);
    }
});

// Flags assigned to this room
Object.defineProperty(Room.prototype, 'assignedFlags', {
    get () {
        return _.filter(Game.flags, flag => flag.memory.assignedRoom && flag.memory.assignedRoom == this.name);
    }
});

// Room properties: structures =========================================================================================

// Total remaining construction progress in this room
Object.defineProperty(Room.prototype, 'remainingConstructionProgress', { // flags assigned to this room
    get () {
        let constructionSites = this.find(FIND_MY_CONSTRUCTION_SITES);
        if (constructionSites.length == 0) {
            return 0;
        } else {
            return _.sum(_.map(constructionSites, site => site.progressTotal - site.progress));
        }

    }
});

Room.prototype.fullestContainer = function () {
    // Set target to the fullest container in the room
    var containers = this.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType == STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > 0
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
        return ERR_NO_TARGET_FOUND;
    }
};

// Room properties: cached searches ====================================================================================

Room.prototype.findCached = function (findKey, findFunction, reCache = false) {
    // findKey: key to store find results to, such as 'sources', 'towers', 'walls', etc.
    // findFunction: find call; ex: function(room) { return room.find(FIND_*) }
    // reCache: boolean to force the room to re-cache this search
    if (reCache == true &&
        this.memory.cacheHistory &&
        this.memory.cacheHistory[findKey] &&
        this.memory.cacheHistory[findKey] == Game.time) {
        reCache = false; // don't rerun the same search in the same timestep
    }
    if (!this.memory.cache) { // Initialize cache if needed
        this.memory.cache = {};
    }
    if (!this.memory.cacheHistory) {
        this.memory.cacheHistory = {};
    }
    var findResults = [];
    // run search and cache or return cached results
    if (reCache || !this.memory.cache[findKey]) { // search
        this.memory.cache[findKey] = [];
        this.memory.cacheHistory[findKey] = Game.time; // when this search was last run
        findResults = findFunction(this);
        // store find results in cache
        for (let item of findResults) {
            this.memory.cache[findKey].push(item.ref); // ATTN: might be problematic for id-less things like flags
        }
    } else { // retrieve cached results
        for (let itemID of this.memory.cache[findKey]) {
            let object = Game.getObjectById(itemID);
            if (!object) { // recache if you hit something that's null
                return this.findCached(findKey, findFunction, true);
            }
            findResults.push(object);
        }
    }
    return findResults;
};

var recache = true; // (Game.cpu.bucket > 9000); // recache automatically at >9000 bucket
Object.defineProperties(Room.prototype, {
    'containers': { // containers in the room
        get() {
            return this.findCached('containers', room => room.find(FIND_STRUCTURES, {
                filter: structure => structure.structureType == STRUCTURE_CONTAINER
            }), recache);
        }
    },
    'storageUnits': { // containers + storage
        get() {
            return this.findCached('storageUnits', room => room.find(FIND_STRUCTURES, {
                filter: structure => structure.structureType == STRUCTURE_CONTAINER ||
                                     structure.structureType == STRUCTURE_STORAGE
            }), recache);
        }
    },
    'towers': { // towers
        get() {
            return this.findCached('towers', room => room.find(FIND_MY_STRUCTURES, {
                filter: structure => structure.structureType == STRUCTURE_TOWER
            }), recache);
        }
    },
    'labs': { // labs
        get() {
            return this.findCached('labs', room => room.find(FIND_MY_STRUCTURES, {
                filter: structure => structure.structureType == STRUCTURE_LAB
            }), recache);
        }
    },
    'sources': { // sources
        get() {
            return this.findCached('sources', room => room.find(FIND_SOURCES));
        }
    },
    'sinks': { // anything requiring a regular supply of energy
        get() {
            return this.findCached('sinks', room => room.find(FIND_MY_STRUCTURES, {
                filter: s => (s.structureType == STRUCTURE_SPAWN ||
                              s.structureType == STRUCTURE_EXTENSION ||
                              s.structureType == STRUCTURE_LAB ||
                              s.structureType == STRUCTURE_TOWER)
            }), recache);
        }
    },
    'repairables': { // anything that can be repaired, excluding walls+ramparts, which are "fortified"
        get() {
            return this.findCached('repairables', room => room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType != STRUCTURE_WALL && s.structureType != STRUCTURE_RAMPART
            }), recache);
        }
    },
    'constructionSites': { // all construction sites; always recached
        get() {
            return this.findCached('constructionSites', room => room.find(FIND_CONSTRUCTION_SITES), true);
        }
    },
    'structureSites': { // construction sites that aren't roads
        get() {
            return this.findCached('structureSites', room => room.find(FIND_CONSTRUCTION_SITES, {
                filter: c => c.structureType != STRUCTURE_ROAD
            }), true);
        }
    },
    'roadSites': { // construction sites for roads
        get() {
            return this.findCached('roadSites', room => room.find(FIND_CONSTRUCTION_SITES, {
                filter: c => c.structureType == STRUCTURE_ROAD
            }), true);
        }
    },
    'barriers': { // walls and ramparts
        get() {
            return this.findCached('barriers', room => room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART
            }), recache);
        }
    },
    'remoteContainers': { // containers in the room
        get() {
            let miningFlags = _.filter(this.assignedFlags, require('map_flag_codes').industry.remoteMine.filter);
            var containers = [];
            for (let flag of miningFlags) {
                if (flag.room == undefined) { // need vision of container
                    continue;
                }
                let nearbyContainers = flag.pos.findInRange(FIND_STRUCTURES, 2, {
                    filter: s => s.structureType == STRUCTURE_CONTAINER
                });
                containers = containers.concat(nearbyContainers);
            }
            return containers;
        }
    }
});


// Run function for room. Executed before roomBrain.run.
Room.prototype.run = function () {
    // Animate each tower: see prototypes_StructureTower
    var towers = this.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER});
    for (let tower of towers) {
        tower.run();
    }
    // Animate each link: transfer to storage when it is >50% full if storage link is empty and cooldown is over
    var links = this.find(FIND_MY_STRUCTURES, {filter: s => s.structureType == STRUCTURE_LINK});
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
                if (link.energy > 0.85 * link.energyCapacity && !link.refillThis &&
                    link.cooldown == 0 && targetLink.energy == 0) {
                    link.transferEnergy(targetLink);
                }
            }
        }
    }
    // Draw all visuals
    var visuals = require('visuals');
    visuals.drawRoomVisuals(this);
};