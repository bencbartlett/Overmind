// Hauler - brings back energy from reserved outposts
var tasks = require('tasks');
var flagCodes = require('map_flag_codes');
var Role = require('Role');

class roleHauler extends Role {
    constructor() {
        super('hauler');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        this.settings.bodySuffix = [WORK, MOVE];
        this.settings.proportionalPrefixSuffix = false;
        this.settings.consoleQuiet = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    collect(creep) {
        var target;
        if (creep.assignment == creep.workRoom.storage) { // remote hauler - assigned to storage
            let allContainers = creep.workRoom.remoteContainers;
            let possibleTargets = _.filter(allContainers,
                                           container => container.predictedEnergyOnArrival > creep.carryCapacity);
            target = _.sortBy(possibleTargets, container => container.miningFlag.pathLengthToAssignedRoomStorage)[0];
            if (!target) { // if nothing needs attention, target whatever is likely fullest
                target = _.sortBy(allContainers, container => -1 * container.predictedEnergyOnArrival)[0];
            }
        } else { // local hauler - assigned to source
            var nearbyContainers = creep.assignment.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: (s) => s.structureType == STRUCTURE_CONTAINER &&
                               _.filter(s.pos.lookFor(LOOK_FLAGS), // don't collect from refillable containers
                                        flagCodes.industry.refillThis.filter).length == 0 &&
                               s.store[RESOURCE_ENERGY] > creep.carry.carryCapacity
            });
            // target fullest of nearby containers
            target = _.sortBy(nearbyContainers,
                              container => container.store[RESOURCE_ENERGY])[nearbyContainers.length - 1];
            if (!target) { // if it can't bring a full load, target the fullest container in the room
                let allContainers = creep.assignment.room.containers;
                target = _.sortBy(allContainers, c => c.store[RESOURCE_ENERGY])[allContainers.length - 1];
            }
        }
        if (target) {
            var collect = tasks('recharge');
            creep.assign(collect, target);
        } else {
            if (!this.settings.consoleQuiet) {
                creep.log("no collect target!");
            }
        }
    } 

    deposit(creep) {
        let target;
        let depositContainers = _.filter(creep.workRoom.containers,
                                         s => _.filter(s.pos.lookFor(LOOK_FLAGS),
                                                       flagCodes.industry.refillThis.filter).length > 0 &&
                                              s.storeCapacity - s.store[RESOURCE_ENERGY] > 0.75 * creep.carryCapacity);
        if (depositContainers.length > 0) {
            target = depositContainers[0];
        } else {
            target = creep.workRoom.storage;
        }
        creep.assign(tasks('deposit'), target);
    }

    newTask(creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.collect(creep);
        } else {
            this.deposit(creep);
        }
    }

    onRun(creep) {
        // Pickup any dropped energy along your route
        let droppedEnergy = creep.pos.findInRange(FIND_DROPPED_ENERGY, 1)[0];
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

module.exports = roleHauler;