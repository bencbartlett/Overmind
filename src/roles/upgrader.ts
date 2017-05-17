// Upgrader creep - sits and upgrades spawn
import {taskRepair} from "../tasks/task_repair";
import {taskGetBoosted} from "../tasks/task_getBoosted";
import {taskSignController} from "../tasks/task_signController";
import {taskRecharge} from "../tasks/task_recharge";
import {AbstractCreep, AbstractSetup} from "./Abstract";

export class UpgraderSetup extends AbstractSetup {
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
}


export class UpgraderCreep extends AbstractCreep {

    constructor(creep: Creep) {
        super(creep);
    }

    recharge() { // TODO: rewrite this
        var bufferSettings = this.colony.overlord.settings.storageBuffer;
        var buffer = bufferSettings.defaultBuffer;
        if (bufferSettings[this.name]) {
            buffer = bufferSettings[this.name];
        }
        if (this.room.controller.ticksToDowngrade < 4000) { // avoid room decay
            buffer = 0;
        }
        var carryCapacity = this.carryCapacity; // filter function can overwrite "this"
        var target = this.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: function (s: Container | Storage | Link) {
                if (s instanceof StructureStorage){
                    return s.energy > carryCapacity;
                } else if (s instanceof StructureContainer) {
                    return s.energy > buffer;
                } else if (s instanceof StructureLink) {
                    return (s.energy >= 0 && s.pos.getRangeTo(s.room.controller) <= 5 && s.refillThis);
                }
            },
        }) as (Container | Storage | Link);
        if (target) { // assign recharge task to this
            this.task = new taskRecharge(target);
        } else {
            if (!this.settings.consoleQuiet && this.settings.notifyOnNoRechargeTargets) {
                this.log('no recharge targets!');
            }
        }
    }

    repairContainer(container: Container) {
        this.task = new taskRepair(container);
    }

    onRun() {
        if (!this.memory.boosted) { // get boosted if you aren't already
            let upgraderBoosters = _.filter(this.room.labs, (lab: StructureLab) =>
                                            lab.assignedMineralType == RESOURCE_CATALYZED_GHODIUM_ACID &&
                                            lab.mineralAmount >= 30 * this.getActiveBodyparts(WORK),
            );
            if (upgraderBoosters.length > 0 && this.ticksToLive > 0.95 * this.lifetime) {
                this.task = new taskGetBoosted(upgraderBoosters[0]);
            }
        } else if (this.room.controller.signedByMe) {
            this.task = new taskSignController(this.room.controller);
        }
    }

    newTask() {
        this.task = null;
        if (this.carry.energy == 0) {
            this.recharge();
        } else {
            let damagedContainers = this.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (s: Structure) => s.structureType == STRUCTURE_CONTAINER && s.hits < s.hitsMax,
            }) as Container[];
            if (damagedContainers.length > 0) {
                this.repairContainer(damagedContainers[0]);
            } else {
                this.requestTask();
            }
        }
    }
    
}
