// Upgrader creep - sits and upgrades spawn
var tasks = require('tasks');
var Role = require('Role');

class roleUpgrader extends Role {
    constructor() {
        super('upgrader');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, WORK, WORK, CARRY, MOVE];
        this.settings.signature = controllerSignature;
        this.settings.consoleQuiet = true;
        this.settings.sayQuiet = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(WORK) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    recharge(creep) { // modification to allow upgraders to upgrade if room is close to decay
        var bufferSettings = creep.room.brain.settings.storageBuffer; // not creep.workRoom; use rules of room you're in
        var buffer = bufferSettings.default;
        if (bufferSettings[this.name]) {
            buffer = bufferSettings[this.name];
        }
        // avoid room decay
        if (creep.room.controller.ticksToDowngrade < 4000) {
            buffer = 0;
        }
        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                           (s.structureType == STRUCTURE_LINK && s.energy >= Math.min(creep.carryCapacity, 400)) ||
                           (s.structureType == STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > buffer)
        });
        if (target) { // assign recharge task to creep
            return creep.assign(tasks('recharge'), target);
        } else {
            if (!this.settings.consoleQuiet && this.settings.notifyOnNoRechargeTargets) {
                creep.log('no recharge targets!');
            }
            return null;
        }
    }

    repairContainer(creep, container) {
        var repair = tasks('repair');
        return creep.assign(repair, container);
    }

    onRun(creep) {
        if (!creep.workRoom.controller.sign || creep.workRoom.controller.sign.text != this.settings.signature) {
            if (creep.signController(creep.workRoom.controller, this.settings.signature) == ERR_NOT_IN_RANGE) {
                creep.moveToVisual(creep.workRoom.controller);
            }
        }
        if (!creep.memory.boosted) { // get boosted if you aren't already
            let upgraderBoosters = _.filter(creep.room.labs,
                                            lab => lab.assignedMineralType == RESOURCE_CATALYZED_GHODIUM_ACID &&
                                                   lab.mineralAmount >= 30 * creep.getActiveBodyparts(WORK));
            if (upgraderBoosters.length > 0 && creep.ticksToLive > 0.95 * creep.lifetime) {
                creep.task = null;
                creep.assign(tasks('getBoosted'), upgraderBoosters[0]);
            }
        }
    }

    newTask(creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            return this.recharge(creep);
        } else {
            let damagedContainers = creep.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.hits < s.hitsMax
            });
            if (damagedContainers.length > 0) {
                return this.repairContainer(creep, damagedContainers[0]);
            } else {
                return this.requestTask(creep);
            }
        }
    }
}

module.exports = roleUpgrader;