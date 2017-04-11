// Worker creep - combines repairer, builder, and upgrader functionality

import {Role} from "./Role";
// import {tasks} from "../maps/map_tasks";
import {taskHarvest} from "../tasks/task_harvest";
import {taskRecharge} from "../tasks/task_recharge";
import {taskGoToRoom} from "../tasks/task_goToRoom";

export class roleWorker extends Role {
    constructor() {
        super('worker');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, CARRY, MOVE];
        this.settings.notifyOnNoTask = true;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(WORK) > 1 &&
                                                  creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }

    onRun(creep: Creep) {
        if (creep.workRoom) {
            if (creep.workRoom.brain.incubating) {
                // only harvest if there are miners away from their stations
                this.settings.workersCanHarvest =
                    creep.workRoom.find(FIND_MY_CREEPS, { // are all sources are occupied by miners?
                        filter: (c: Creep) => c.memory.role == 'miner' && // is there a miner?
                                              c.pos.findInRange(FIND_SOURCES, 1).length > 0 // is it at its source?
                    }).length < creep.room.sources.length ||
                    creep.room.containers.length < creep.room.sources.length; // or are there not containers yet?
                this.renewIfNeeded(creep);
            }
            // if a creep is trying to harvest and isn't getting any energy and a container becomes available, stop harvest
            if (creep.task && creep.task.name == 'harvest' && creep.pos.findInRange(FIND_SOURCES, 1).length == 0) {
                if (_.filter(creep.room.storageUnits, (s: StructureContainer | StructureStorage) =>
                             (s.structureType == STRUCTURE_CONTAINER
                              && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                             (s.structureType == STRUCTURE_STORAGE
                              && s.store[RESOURCE_ENERGY] > creep.room.brain.settings.storageBuffer['worker']),
                    ).length > 0) {
                    creep.task = null;
                }
            }
            // // if a creep was assigned to build an outpost room and it's done, send it back to original room
            // if (creep.workRoom.reservedByMe &&
            //     creep.workRoom.constructionSites.length == 0 &&
            //     creep.workRoom.brain.getTasks('repair').length == 0) {
            //     creep.setWorkRoom(creep.memory.data.origin);
            // }
        }
    }

    // Old harvest function in case I need it in the future
    harvest(creep: Creep) {
        var target = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE, {
            filter: (source: Source) => source.targetedBy.length < 3,
        }) as Source;
        if (target) {
            return creep.assign(new taskHarvest(target));
        } else {
            creep.log("no harvestable sources found!");
            return null;
        }
    }

    // Old recharge function in case I need it in the future
    recharge(creep: Creep) {
        // try to find closest container or storage
        var target;
        if (this.settings.targetFullestContainer) {
            target = creep.room.fullestContainer();
        } else {
            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s: Container | Storage) =>
                (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                (s.structureType == STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] >
                                                         creep.room.brain.settings.storageBuffer['worker']),
            }) as Container | Storage;
        }
        if (target) {
            // assign recharge task to creep
            return creep.assign(new taskRecharge(target));
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

    run(creep: Creep) {
        // Execute on-run code
        this.onRun(creep);
        // TODO: can't get task from room brain of other room because findClosestByRange() doesn't span multiple rooms
        if (creep.room != creep.workRoom) { // workers need to be in their designated room to get tasks
            creep.assign(new taskGoToRoom(creep.assignment));
        }
        // Check each tick that the task is still valid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        // If there is a task, execute it
        return this.executeTask(creep);
    }
}
