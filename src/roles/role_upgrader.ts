// Upgrader creep - sits and upgrades spawn
import {Role} from "./Role";
import {taskRepair} from "../tasks/task_repair";
import {taskGetBoosted} from "../tasks/task_getBoosted";
import {taskSignController} from "../tasks/task_signController";
import {taskRecharge} from "../tasks/task_recharge";

export class roleUpgrader extends Role {
    constructor() {
        super('upgrader');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, WORK, WORK, CARRY, MOVE];
        this.settings.signature = controllerSignature;
        this.settings.consoleQuiet = true;
        this.settings.sayQuiet = true;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(WORK) > 1 &&
                                                  creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }

    recharge(creep: Creep) { // modification to allow upgraders to upgrade if room is close to decay
        var bufferSettings = creep.colony.overlord.settings.storageBuffer; // not creep.workRoom; use rules of room you're in
        var buffer = bufferSettings.default;
        if (bufferSettings[this.name]) {
            buffer = bufferSettings[this.name];
        }
        // avoid room decay
        if (creep.room.controller && creep.room.controller.ticksToDowngrade < 4000) {
            buffer = 0;
        }
        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: function (s: Container | Storage | Link) {
                if (s instanceof StructureStorage){
                    return s.store[RESOURCE_ENERGY] > creep.carryCapacity;
                } else if (s instanceof StructureContainer) {
                    return s.store[RESOURCE_ENERGY] > buffer;
                } else if (s instanceof StructureLink) {
                    return (s.energy >= 0 && s.pos.getRangeTo(s.room.controller) <= 5 && s.refillThis);
                }
            },
        }) as (Container | Storage | Link);
        if (target) { // assign recharge task to creep
            return creep.assign(new taskRecharge(target));
        } else {
            if (!this.settings.consoleQuiet && this.settings.notifyOnNoRechargeTargets) {
                creep.log('no recharge targets!');
            }
            return "";
        }
    }

    repairContainer(creep: Creep, container: Container) {
        return creep.assign(new taskRepair(container));
    }

    onRun(creep: Creep) {
        if (!creep.memory.boosted) { // get boosted if you aren't already
            let upgraderBoosters = _.filter(creep.room.labs, (lab: StructureLab) =>
                                            lab.assignedMineralType == RESOURCE_CATALYZED_GHODIUM_ACID &&
                                            lab.mineralAmount >= 30 * creep.getActiveBodyparts(WORK),
            );
            if (upgraderBoosters.length > 0 && creep.ticksToLive > 0.95 * creep.lifetime) {
                return creep.assign(new taskGetBoosted(upgraderBoosters[0]));
            }
        }
        if (creep.room.controller.signedByMe) {
            return creep.assign(new taskSignController(creep.room.controller));
        }
    }

    newTask(creep: Creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.recharge(creep);
        } else {
            let damagedContainers = creep.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (s: Structure) => s.structureType == STRUCTURE_CONTAINER && s.hits < s.hitsMax,
            }) as Container[];
            if (damagedContainers.length > 0) {
                this.repairContainer(creep, damagedContainers[0]);
            } else {
                this.requestTask(creep);
            }
        }
    }
}
