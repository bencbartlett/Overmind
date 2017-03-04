// Miner - stationary harvester for container mining. Fills containers and sits in place.
var tasks = require('tasks');
var Role = require('Role');

class roleMiner extends Role {
    constructor() {
        super('miner');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, WORK, WORK, CARRY, MOVE, MOVE];
        // this.settings.remoteBodyPattern = [WORK, WORK, CARRY, MOVE, MOVE];
        this.settings.allowBuild = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(WORK) > 5 && // 5 work parts saturate a source
                                         creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    create(spawn, {assignment, workRoom = null, patternRepetitionLimit = 2}) {
        if (!workRoom) {
            workRoom = assignment.roomName;
        }
        // if (!spawn.room.controller.inSameRoomAs(assignment)) {
        //     this.settings.bodyPattern = this.settings.remoteBodyPattern; // long distance miner needs to walk
        // }
        let creep = this.generateLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: 2 // don't need more than 6 work parts on a miner
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
            return creep.assign(tasks('deposit'), target);
        } else {
            return this.dropEnergy(creep);
        }
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
            creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 10;
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
            this.settings.workersCanHarvest = true;
            this.renewIfNeeded(creep);
        }
    }
}

// var roleMinerOld = {
//     /** @param {Creep} creep **/
//     /** @param {StructureSpawn} spawn **/
//
//     settings: {
//         bodyPattern: [WORK, WORK, CARRY, MOVE],
//         remoteBodyPattern: [WORK, WORK, CARRY, MOVE, MOVE], // extra move part because of long distance travel
//         allowBuild: true
//     },
//
//     create: function (spawn, assignment, {workRoom = spawn.room.name, patternRepetitionLimit = 3, remote = false}) {
//         /** @param {StructureSpawn} spawn **/
//         var bodyPattern;
//         if (remote) {
//             bodyPattern = this.settings.remoteBodyPattern;
//         } else {
//             bodyPattern = this.settings.bodyPattern;
//         }
//         // calculate the most number of pattern repetitions you can use with available energy
//         var numRepeats = Math.floor(spawn.room.energyCapacityAvailable / spawn.cost(bodyPattern));
//         // make sure the creep is not too big (more than 50 parts)
//         numRepeats = Math.min(Math.floor(50 / bodyPattern.length), numRepeats, patternRepetitionLimit);
//         // create the body
//         var body = [];
//         for (let i = 0; i < numRepeats; i++) {
//             body = body.concat(bodyPattern);
//         }
//         // create the creep and initialize memory
//         return spawn.createCreep(body, spawn.creepName('miner'), {
//             role: 'miner', workRoom: workRoom, task: null, remote: remote, assignment: assignment,
//             data: {origin: spawn.room.name, replaceAt: 0}
//         });
//     },
//
//     buildSite: function (creep, containerSite) {
//         var build = tasks('build');
//         return creep.assign(build, containerSite);
//     },
//
//     repairContainer: function (creep, container) {
//         var repair = tasks('repair');
//         return creep.assign(repair, container);
//     },
//
//     dropEnergy: function (creep) {
//         creep.log("no container; dropping!");
//         var drop = tasks('dropEnergy');
//         return creep.assign(drop);
//     },
//
//     depositContainer: function (creep) {
//         // select emptiest of containers that are within range 1 of creep (helps with adjacent sources)
//         var target = _.sortBy(creep.pos.findInRange(FIND_STRUCTURES, 1, {
//             filter: (s) => s.structureType == STRUCTURE_CONTAINER
//         }), container => container.store[RESOURCE_ENERGY])[0];
//         if (target) {
//             return creep.assign(tasks('deposit'), target);
//         } else {
//             return this.dropEnergy(creep);
//         }
//     },
//
//     depositLink: function (creep) {
//         // select emptiest of containers that are within range 1 of creep (helps with adjacent sources)
//         var target = _.sortBy(creep.pos.findInRange(FIND_MY_STRUCTURES, 2, {
//             filter: (s) => s.structureType == STRUCTURE_LINK && s.energy < s.energyCapacity
//         }), link => link.energy)[0];
//         if (target) {
//             return creep.assign(tasks('deposit'), target);
//         }
//     },
//
//     harvest: function (creep) {
//         var target;
//         var assignment = deref(creep.memory.assignment);
//         if (assignment.room) {
//             target = assignment.pos.lookFor(LOOK_SOURCES)[0];
//         } else {
//             target = assignment;
//         }
//         var taskHarvest = tasks('harvest');
//         taskHarvest.data.quiet = true;
//         return creep.assign(taskHarvest, target);
//     },
//
//     newTask: function (creep) {
//         // 1: harvest when empty
//         creep.task = null;
//         if (creep.carry.energy == 0) {
//             return this.harvest(creep);
//         }
//         // 1.5: log first time of deposit or build tasks as replacement time
//         if (creep.memory.data.replaceAt == 0) {
//             creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 10;
//         }
//         // 2: find any nearby damaged containers and repair them
//         var damagedContainers = creep.pos.findInRange(FIND_STRUCTURES, 3, {
//             filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.hits < s.hitsMax
//         });
//         if (damagedContainers.length > 0) {
//             return this.repairContainer(creep, damagedContainers[0]);
//         }
//         // 3: build construction sites
//         if (this.settings.allowBuild) {
//             var constructionSites = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2, {
//                 filter: (s) => s.structureType == STRUCTURE_CONTAINER // miners can only build their own containers
//             });
//             if (constructionSites.length > 0) {
//                 return this.buildSite(creep, creep.pos.findClosestByRange(constructionSites));
//             }
//         }
//         // 4: deposit into link or container
//         if (creep.assignment.linked) {
//             return this.depositLink(creep);
//         } else {
//             return this.depositContainer(creep);
//         }
//     },
//
//     executeTask: function (creep) {
//         // execute the task
//         creep.task.step();
//     },
//
//     run: function (creep) {
//         if (creep.getActiveBodyparts(WORK) < 0.75 * creep.getBodyparts(WORK)) {
//             creep.suicide(); // kill off miners that might have gotten damaged so they don't sit and try to mine
//         }
//         // get new task if this one is invalid
//         if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
//             this.newTask(creep);
//         }
//         if (creep.task) {
//             return this.executeTask(creep);
//         }
//         creep.log('Could not receive or execute task. Linkers or containers might be full...')
//     }
// };

module.exports = roleMiner;