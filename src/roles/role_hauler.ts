// Hauler - brings back energy from reserved outposts

import {Role} from "./Role";
// import {tasks} from "../maps/map_tasks";
import {taskRecharge} from "../tasks/task_recharge";
import {taskDeposit} from "../tasks/task_deposit";
// import {flagFilters} from "../maps/map_flag_filters";

export class roleHauler extends Role {
    constructor() {
        super('hauler');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        this.settings.bodySuffix = [WORK, MOVE];
        this.settings.proportionalPrefixSuffix = false;
        this.settings.consoleQuiet = true;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }

    collect(creep: Creep) {
        var target;
        if (creep.assignment == creep.workRoom.storage) { // remote hauler - assigned to storage
            let allContainers: StructureContainer[] = creep.workRoom.remoteContainers;
            let possibleTargets = _.filter(allContainers,
                                           container => container.predictedEnergyOnArrival > creep.carryCapacity);
            target = _.sortBy(possibleTargets, container => container.miningFlag.pathLengthToAssignedRoomStorage)[0];
            if (!target) { // if nothing needs attention, target whatever is likely fullest
                target = _.sortBy(allContainers, container => -1 * container.predictedEnergyOnArrival)[0];
            }
        } else { // local hauler - assigned to source
            var nearbyContainers = creep.assignment.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: (s: Container) => s.structureType == STRUCTURE_CONTAINER &&
                                          _.filter(s.pos.lookFor(LOOK_FLAGS), // don't collect from refill containers
                                                   flagCodes.industry.refillThis.filter).length == 0 &&
                                          s.store[RESOURCE_ENERGY] > creep.carryCapacity,
            }) as Container[];
            // target fullest of nearby containers
            target = _.sortBy(nearbyContainers,
                              container => container.store[RESOURCE_ENERGY])[nearbyContainers.length - 1];
            if (!target) { // if it can't bring a full load, target the fullest container
                if (creep.assignment.room) {
                    let allContainers: StructureContainer[] = creep.assignment.room.containers;
                    target = _.sortBy(allContainers, c => c.store[RESOURCE_ENERGY])[allContainers.length - 1];
                } else {
                    creep.log('No vision of assigned room!');
                }
            }
        }
        if (target) {
            creep.assign(new taskRecharge(target));
        } else {
            if (!this.settings.consoleQuiet) {
                creep.log("no collect target!");
            }
        }
    }

    deposit(creep: Creep) {
        let target;
        let depositContainers = _.filter(creep.workRoom.containers, (s: StructureContainer) =>
                                         _.filter(s.pos.lookFor(LOOK_FLAGS),
                                                  flagCodes.industry.refillThis.filter).length > 0 &&
                                         s.storeCapacity - s.store[RESOURCE_ENERGY] > 0.75 * creep.carryCapacity,
        );
        if (depositContainers.length > 0) {
            target = depositContainers[0];
        } else {
            target = creep.workRoom.storage;
        }
        if (target) {
            creep.assign(new taskDeposit(target));
        }
    }

    newTask(creep: Creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.collect(creep);
        } else {
            this.deposit(creep);
        }
    }

    onRun(creep: Creep) {
        // Pickup any dropped energy along your route
        let droppedEnergy = creep.pos.findInRange(FIND_DROPPED_ENERGY, 1)[0] as Resource;
        if (droppedEnergy) {
            creep.pickup(droppedEnergy);
            if (droppedEnergy.amount > 0.5 * creep.carryCapacity) {
                this.deposit(creep);
            }
        }

        // Repair nearby roads as you go
        creep.repairNearbyDamagedRoad(); // repair roads if you are capable
    }

}
