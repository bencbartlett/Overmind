// Room brain: processes tasks from room and requests from worker body
var tasks = require('tasks');

var RoomBrain = class {
    constructor(roomName) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        // Settings shared across all rooms
        this.settings = {
            fortifyLevel: 30000, // fortify all walls/ramparts to this level
            workerPatternRepetitionLimit: 3, // maximum number of body repetitions for workers
            minersPerSource: 1 // number of miners to assign to a source
        };
        // Task priorities
        this.taskPriorities = [
            'pickup',
            'repair',
            'build',
            'fortify',
            'upgrade'
        ];
        // Task role conditions
        this.assignmentRoles = {
            'pickup': ['supplier', 'hauler'],
            'repair': ['worker', 'miner'],
            'build': ['worker', 'miner'],
            'fortify': ['worker'],
            'upgrade': ['worker']
        };
        // Task assignment conditions
        this.assignmentConditions = {
            'pickup': creep => creep.getActiveBodyparts(CARRY) > 0,
            'repair': creep => creep.getActiveBodyparts(WORK) > 0,
            'build': creep => creep.getActiveBodyparts(WORK) > 0,
            'fortify': creep => creep.getActiveBodyparts(WORK) > 0,
            'upgrade': creep => creep.getActiveBodyparts(WORK) > 0
        }
    }

    getTasks() {
        var prioritizedTasks = {};
        // Priority: (can be switched with DEFCON system)
        // 0: Defense (to be implemented)
        // 1: Handle source miners/suppliers
        // 2: Pick up energy
        prioritizedTasks['pickup'] = this.room.find(FIND_DROPPED_ENERGY);
        // 3: Repair structures
        prioritizedTasks['repair'] = this.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax &&
                           s.isTargeted('repairer') == false &&
                           s.structureType != STRUCTURE_CONTAINER && // containers are repaired by miners
                           s.structureType != STRUCTURE_WALL && // walls are fortify tasks
                           s.structureType != STRUCTURE_RAMPART &&
                           (s.structureType != STRUCTURE_ROAD || s.hits < 0.2 * s.hitsMax) // roads repaired as you go
        });
        // 4: Build construction jobs
        prioritizedTasks['build'] = this.room.find(FIND_CONSTRUCTION_SITES);
        // 5: Fortify walls
        prioritizedTasks['fortify'] = this.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits < this.settings.fortifyLevel &&
                           (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
        });
        // 6: Upgrade controller
        prioritizedTasks['upgrade'] = [this.room.controller.my && this.room.controller]; // can't upgrade reservations
        // To within some spatial limit, creeps should always take highest priority task regardless of room.
        return prioritizedTasks;
    }

    assignTask(creep) {
        var prioritizedTasks = this.getTasks();
        for (let task of this.taskPriorities) { // loop through tasks in descending priority
            // If task exists and can be assigned to this creep, then do so
            if (prioritizedTasks[task].length > 0 &&
                this.assignmentRoles[task].includes(creep.memory.role) &&
                this.assignmentConditions[task](creep)) {
                var target = creep.pos.findClosestByPath(prioritizedTasks[task]);
                creep.assign(tasks(task), target);
                return OK;
            }
        }
        creep.log("could not get assignment from room brain!");
    }

    calculateCreepRequirements() {
        // Calculate needed numbers of workers
        // TODO: better calculation of worker requirements
        // // Case 1: if room has storage, use average storage fullness as indicator
        // if (this.room.storage) {
        //     if (this.room.storage.store[RESOURCE_ENERGY] > 0) {
        //
        //     }
        // }
        // // Case 2: if room has no storage, ...?
        var spawn = this.room.find(FIND_MY_SPAWNS)[0];
        if (spawn) {
            var energy = this.room.energyCapacityAvailable;
            var workerBodyPattern = require('role_worker').settings.bodyPattern;
            var workerSize = Math.min(Math.floor(energy /spawn.cost(workerBodyPattern)),
                                      this.settings.workerPatternRepetitionLimit);
            var upgradeEnergyPerTick = workerSize * 1.25; // slightly overestimate energy requirements for leeway
            var sourceEnergyPerTick = (3000 / 300) * this.room.find(FIND_SOURCES).length;
            return Math.floor(sourceEnergyPerTick / upgradeEnergyPerTick);
        } else {
            return 0;
        }
    }

    handleSources() {
        var sources = this.room.find(FIND_SOURCES); // don't use ACTIVE_SOURCES; need to always be handled
        for (let source of sources) {
            // TODO: calculation of number of miners to assign to each source based on max size of creep
            let assignedMiners = _.filter(source.assignedCreeps,
                                          creep => creep.memory.role == 'miner' &&
                                                   creep.memory.data.replaceNow == false);
            if (assignedMiners.length < this.settings.minersPerSource) {
                // spawn a new miner that will ask for an assignment on birth
                var minerBehavior = require('role_miner');
                var spawn = this.room.find(FIND_MY_SPAWNS)[0]; // TODO: multiple spawns per room?
                if (spawn) {
                    var newMiner = minerBehavior.create(spawn, source.id);
                    return OK;
                } else {
                    return ERR_NO_SPAWN_IN_ROOM;
                }
            }
        }
    }

    // TODO: safe mode

    run() { // list of things executed each tick
        if (this.handleSources() == OK) { // make sure everyone's assigned to a source
            return OK;
        }
        var numWorkers = _.filter(Game.creeps,
                                  creep => creep.memory.role == 'worker' &&
                                           creep.memory.data.serviceRoom == this.room.name).length;
        if (numWorkers < this.calculateCreepRequirements()) {
            var workerBehavior = require('role_worker');
            var spawn = this.room.find(FIND_MY_SPAWNS)[0];
            if (spawn) {
                var newWorker = workerBehavior.create(spawn, this.settings.workerPatternRepetitionLimit);
                return OK;
            } else {
                return ERR_NO_SPAWN_IN_ROOM;
            }
        }
    }
};


module.exports = RoomBrain;