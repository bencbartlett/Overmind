// Miner - stationary harvester for container mining. Fills containers and sits in place.
var tasks = require('tasks');
var Role = require('Role');

class roleMiner extends Role {
    constructor() {
        super('miner');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, WORK, CARRY, MOVE];
        // this.settings.remoteBodyPattern = [WORK, WORK, CARRY, MOVE, MOVE];
        this.settings.allowBuild = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(WORK) > 1 && // 5 work parts saturate a source
                                         creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    create(spawn, {assignment, workRoom = null, patternRepetitionLimit = 3}) {
        if (!workRoom) {
            workRoom = assignment.roomName;
        }
        // if (!spawn.room.controller.inSameRoomAs(assignment)) {
        //     this.settings.bodyPattern = this.settings.remoteBodyPattern; // long distance miner needs to walk
        // }
        let creep = this.generateLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: 3 // don't need more than 6 work parts on a miner
        });
        return creep; // spawn.createCreep(creep.body, creep.name, creep.memory);
    }

    buildSite(creep, containerSite) {
        var build = tasks('build');
        return creep.assign(build, containerSite);
    }

    repairContainer(creep, container) {
        var repair = tasks('repair');
        return creep.assign(repair, container);
    }

    dropEnergy(creep) {
        creep.log("no container; dropping!");
        var drop = tasks('dropEnergy');
        return creep.assign(drop);
    }

    depositContainer(creep) {
        // select emptiest of containers that are within range 1 of creep (helps with adjacent sources)
        var target = _.sortBy(creep.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER
        }), container => container.store[RESOURCE_ENERGY])[0];
        if (target) {
            creep.moveTo(target); // get on top of the container if you're not already
            return creep.assign(tasks('deposit'), target);
        } 
        // else {
        //     return this.dropEnergy(creep);
        // }
    }

    depositLink(creep) {
        // select emptiest of containers that are within range 1 of creep (helps with adjacent sources)
        var target = _.sortBy(creep.pos.findInRange(FIND_MY_STRUCTURES, 2, {
            filter: (s) => s.structureType == STRUCTURE_LINK && s.energy < s.energyCapacity
        }), link => link.energy)[0];
        if (target) {
            return creep.assign(tasks('deposit'), target);
        }
    }

    harvest(creep) {
        var target;
        if (creep.assignment.room) {
            target = creep.assignment.pos.lookFor(LOOK_SOURCES)[0];
        } else {
            target = creep.assignment;
        }
        return creep.assign(tasks('harvest'), target);
    }

    newTask(creep) {
        // 1: harvest when empty
        creep.task = null;
        if (creep.carry.energy == 0) {
            return this.harvest(creep);
        }
        // 1.5: log first time of deposit or build tasks as replacement time
        if (creep.memory.data.replaceAt == 0) {
            creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 20;
        }
        // 2: find any nearby damaged containers and repair them
        var damagedContainers = creep.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.hits < s.hitsMax
        });
        if (damagedContainers.length > 0) {
            return this.repairContainer(creep, damagedContainers[0]);
        }
        // 3: build construction sites
        if (this.settings.allowBuild) {
            var constructionSites = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2, {
                filter: (s) => s.structureType == STRUCTURE_CONTAINER // miners can only build their own containers
            });
            if (constructionSites.length > 0) {
                return this.buildSite(creep, creep.pos.findClosestByRange(constructionSites));
            }
        }
        // 4: deposit into link or container
        if (creep.assignment.linked) {
            return this.depositLink(creep);
        } else {
            return this.depositContainer(creep);
        }
    }

    onRun(creep) {
        if (creep.getActiveBodyparts(WORK) < 0.75 * creep.getBodyparts(WORK)) {
            creep.suicide(); // kill off miners that might have gotten damaged so they don't sit and try to mine
        }
        if (creep.room.brain.incubating) {
            if (creep.carry.energy == 0) { // request renewal after a mining cycle is finished
                this.renewIfNeeded(creep);
            }
        }
    }
}

module.exports = roleMiner;