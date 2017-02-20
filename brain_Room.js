// Room brain: processes tasks from room and requests from worker body
var tasks = require('tasks');

var RoomBrain = class {
    constructor(roomName) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        // Settings shared across all rooms
        this.settings = {
            fortifyLevel: 30000
        };
        // Task priorities
        this.taskPriorities = [
            'pickup',
            'repair',
            'build',
            'fortify',
            'upgrade'
        ];
        // Task assignment conditions
        this.assignmentConditions = {
            'pickup': creep => creep.memory.role == 'supplier' ||
                               creep.memory.role == 'hauler',
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
            if (prioritizedTasks[task].length > 0 && this.assignmentConditions[task](creep)) {
                var target = creep.pos.findClosestByPath(prioritizedTasks[task]);
                creep.assign(tasks(task), target);
                return OK;
            }
        }
    }
};


module.exports = RoomBrain;