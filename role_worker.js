// Worker creep - combines repairer, builder, and upgrader functionality
var tasks = require('tasks');
var Role = require('Role');

class roleWorker extends Role {
    constructor() {
        super('worker');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, CARRY, MOVE];
        this.settings.notifyOnNoTask = false;
        this.roleRequirements = creep => creep.getActiveBodyparts(WORK) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    onRun(creep) {
        if (creep.room.brain.incubating) {
            // only harvest if there are miners away from their stations
            this.settings.workersCanHarvest =
                creep.room.find(FIND_MY_CREEPS, { // are all sources are occupied by miners?
                    filter: c => c.memory.role == 'miner' && // is there a miner?
                                 c.pos.findInRange(FIND_SOURCES, 1).length > 0 // is it at its source?
                }).length < creep.room.sources.length ||
                creep.room.containers.length < creep.room.sources.length; // or are there not containers yet?
            this.renewIfNeeded(creep);
        }
        if (creep.conditionalMoveToWorkRoom() != OK) { // workers sometimes stray from their service rooms
            this.settings.sayQuiet = true;
            this.settings.consoleQuiet = true;
            return ERR_NOT_IN_SERVICE_ROOM;
        }
        // if a creep is trying to harvest and isn't getting any energy and a container becomes available, stop harvest
        if (creep.task && creep.task.name == 'harvest' && creep.pos.findInRange(FIND_SOURCES, 1).length == 0) {
            if (_.filter(creep.room.storageUnits,
                         s => (s.structureType == STRUCTURE_CONTAINER
                               && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                              (s.structureType == STRUCTURE_STORAGE
                               && s.store[RESOURCE_ENERGY] > creep.room.brain.settings.storageBuffer['worker'])
                ).length > 0) {
                creep.task = null;
            }
        }
        // if a creep was assigned to build an outpost room and it's done, send it back to original room
        if (creep.room.reservedByMe &&
            creep.room.constructionSites.length == 0 &&
            creep.room.brain.getTasks('repair').length == 0) {
            creep.setWorkRoom(creep.memory.data.origin);
        }
    }

    // Old harvest function in case I need it in the future
    harvest(creep) {
        var target = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE, {
            filter: (source) => source.targetedBy < 3
        });
        if (target) {
            return creep.assign(tasks('harvest'), target);
        } else {
            creep.log("no harvestable sources found!");
            return null;
        }
    }

    // Old recharge function in case I need it in the future
    recharge(creep) {
        // try to find closest container or storage
        var target;
        if (this.settings.targetFullestContainer) {
            target = creep.room.fullestContainer();
        } else {
            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s) => (s.structureType == STRUCTURE_CONTAINER
                                && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                               (s.structureType == STRUCTURE_STORAGE
                                && s.store[RESOURCE_ENERGY] > creep.room.brain.settings.storageBuffer['worker'])
            });
        }
        if (target) {
            // assign recharge task to creep
            return creep.assign(tasks('recharge'), target);
        } else {
            // if no targetable containers, see if worker can harvest
            if (this.settings.workersCanHarvest) {
                return this.harvest(creep);
            } else {
                // creep.log("no containers found and harvesting disabled!");
                return null;
            }
        }
    }

}

module.exports = roleWorker;