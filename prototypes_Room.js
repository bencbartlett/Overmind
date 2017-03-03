var roomBrain = require('Brain_Room');

Object.defineProperty(Room.prototype, 'brain', {
    get () {
        return new roomBrain(this.name);
    },
    set () {
        console.log("cannot set Room.brain for " + this.name);
    }
});

Object.defineProperty(Room.prototype, 'spawns', {
    get () {
        return this.find(FIND_MY_SPAWNS);
    }
});

Object.defineProperty(Room.prototype, 'creeps', {
    get () {
        return _.filter(Game.creeps, creep => creep.workRoom == this);
    }
});

Object.defineProperty(Room.prototype, 'tasks', {
    get () {
        var tasks = this.creeps.map(creep => creep.task);
        return _.filter(tasks, task => task != null);
    }
});

Object.defineProperty(Room.prototype, 'taskTargets', {
    get () {
        var targets = this.tasks.map(task => task.target);
        return _.filter(targets, target => target != null);
    }
});

Object.defineProperty(Room.prototype, 'creepsInRoom', {
    get () {
        return _.filter(Game.creeps, creep => creep.room == this);
    }
});

Object.defineProperty(Room.prototype, 'hostiles', {
    get () {
        return this.find(FIND_HOSTILE_CREEPS);
    }
});

Object.defineProperty(Room.prototype, 'hostileStructures', {
    get () {
        return this.find(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits});
    }
});

Object.defineProperty(Room.prototype, 'flags', { // flags physically in this room
    get () {
        return _.filter(Game.flags, flag => flag.room == this);
    }
});

Object.defineProperty(Room.prototype, 'assignedFlags', { // flags assigned to this room
    get () {
        return _.filter(Game.flags, flag => flag.memory.assignedRoom && flag.memory.assignedRoom == this.name);
    }
});

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


//noinspection JSUnusedGlobalSymbols
Room.prototype.totalSourceCapacity = function () {
    if (this.memory.miningCapacity != undefined) {
        return this.memory.miningCapacity;
    } else {
        var capacity = 0;
        var sources = this.find(FIND_SOURCES);
        for (let i in sources) {
            capacity += sources[i].capacity();
        }
        this.memory.miningCapacity = capacity;
        return capacity;
    }
};

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

Room.prototype.findCached = function (findKey, findFunction, reCache = false) {
    // findKey: key to store find results to, such as 'sources', 'towers', 'walls', etc.
    // findFunction: find call; ex: function(room) { return room.find(FIND_*) }
    // reCache: boolean to force the room to re-cache this search
    if (reCache || !this.memory.cache) { // Initialize cache
        this.memory.cache = {};
    }
    var findResults = [];
    // run search and cache or return cached results
    if (reCache || !this.memory.cache[findKey]) { // search
        this.memory.cache[findKey] = [];
        findResults = findFunction(this);
        // store find results in cache
        for (let item of findResults) {
            this.memory.cache[findKey].push(item.ref); // ATTN: might be problematic for id-less things like flags
        }
    } else { // retrieve cached results
        for (let itemID of this.memory.cache[findKey]) {
            findResults.push(Game.getObjectById(itemID));
        }
    }
    return findResults;
};

// Room.prototype.remainingMinerSourceAssignments = function () {
//     var sources = this.find(FIND_SOURCES);
//     var miners = this.find(FIND_MY_CREEPS, {filter: (c) => c.memory.role == 'miner'});
//     var assignments = {};
//     for (let i in sources) {
//         // assignment becomes a dictionary with source ID keys and number of remaining spots as values
//         let numAssigned = _.filter(miners, (c) => c.memory.assignment == sources[i].ref).length;
//         let maxSpots = Math.min(sources[i].capacity(), 1);
//         assignments[sources[i].ref] = maxSpots - numAssigned;
//     }
//     return assignments;
// };

Room.prototype.isUntargetedRepair = function () {
    // Set target to closest repair job that is not currently targeted by any other repairer
    // Ignore walls, ramparts, and roads above 20% health, since roads can be taken care of
    // more efficiently by repairNearbyDamagedRoads() function
    var structure = this.find(FIND_STRUCTURES, {
        filter: (s) => s.hits < s.hitsMax &&
                       s.isTargeted('repairer') == false &&
                       s.structureType != STRUCTURE_CONTAINER && // containers are repaired by miners
                       s.structureType != STRUCTURE_WALL &&
                       s.structureType != STRUCTURE_RAMPART &&
                       (s.structureType != STRUCTURE_ROAD || s.hits < 0.2 * s.hitsMax)
    });
    if (structure) {
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

Room.prototype.isWallLowerThan = function (hp) {
    // Set target to closest wall or rampart with less than hp hits; wall repairs allow duplicate repair jobs
    var wall = this.find(FIND_STRUCTURES, {
        filter: (s) => s.hits < hp && (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
    });
    if (wall) {
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

//noinspection JSUnusedGlobalSymbols
Room.prototype.convertAllCreeps = function (convertFrom, convertTo) {
    var creepsToConvert = this.find(FIND_MY_CREEPS, {filter: (c) => c.memory.role == convertFrom});
    for (let i in creepsToConvert) {
        let creep = creepsToConvert[i];
        // Change role
        creep.memory.role = convertTo;
        // Clear mode
        creep.memory.mode = undefined;
        // Clear target
        creep.memory.target = undefined;
    }
};

// Run function for room. Executed before roomBrain.run.
Room.prototype.run = function () {
    // Animate each tower: see prototypes_StructureTower
    var towers = this.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER}); // TODO: this is costly
    for (let tower of towers) {
        tower.run();
    }
    // Animate each link: transfer to storage when it is >50% full if storage link is empty and cooldown is over
    var links = this.find(FIND_MY_STRUCTURES, {filter: s => s.structureType == STRUCTURE_LINK});
    if (links.length > 0) {
        var storageLink = this.storage.links[0];
        for (let link of links) {
            if (link != storageLink) {
                if (link.energy > 0.5 * link.energyCapacity && link.cooldown == 0 && storageLink.energy == 0) {
                    link.transferEnergy(storageLink);
                }
            }
        }
    }
    // Draw all visuals
    var visuals = require('visuals');
    visuals.drawRoomVisuals(this);
};