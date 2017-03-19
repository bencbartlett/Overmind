// Hauler - brings back energy from reserved outposts
var tasks = require('tasks');
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
        let allContainers = creep.workRoom.remoteContainers;
        let possibleTargets = _.filter(allContainers,
                                       container => container.predictedEnergyOnArrival > creep.carryCapacity);
        let target = _.sortBy(possibleTargets, container => container.miningFlag.pathLengthToAssignedRoomStorage)[0];
        if (!target) { // if nothing needs attention, target whatever is likely fullest
            target = _.sortBy(allContainers, container => -1 * container.predictedEnergyOnArrival)[0];
        }
        // if (!creep.assignment.room) { // if you don't have vision of the room
        //     return creep.moveToVisual(creep.assignment.pos, 'blue');
        // }
        // // if you do have vision, go ahead and target the relevant container
        // var nearbyContainers = creep.assignment.pos.findInRange(FIND_STRUCTURES, 2, {
        //     filter: (s) => s.structureType == STRUCTURE_CONTAINER &&
        //                    s.store[RESOURCE_ENERGY] > creep.carry.carryCapacity
        // });
        // // target fullest of nearby containers
        // var target = _.sortBy(nearbyContainers,
        //                       container => container.store[RESOURCE_ENERGY])[nearbyContainers.length - 1];
        // if (!target) { // if it can't bring a full load, target the fullest container in the room
        //     let allContainers = creep.assignment.room.containers;
        //     target = _.sortBy(allContainers, c => c.store[RESOURCE_ENERGY])[allContainers.length - 1];
        // }
        if (target) {
            var collect = tasks('recharge');
            creep.assign(collect, target);
        } else {
            creep.log("no collect target!");
        }
    }

    deposit(creep) {
        creep.assign(tasks('deposit'), creep.assignment);
        // var target = creep.assignment;
        // if (target) {
        //     var deposit = tasks('deposit');
        //     creep.assign(deposit, target);
        // } else {
        //     creep.log("no storage in " + creep.workRoom.name);
        // }
    }

    newTask(creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            // var pathLength;
            // if (creep.workRoom.storage.inSameRoomAs(creep.assignment)) {
            //     pathLength = creep.assignment.pathLengthToStorage;
            // } else {
            //     pathLength = creep.assignment.pathLengthToAssignedRoomStorage;
            // }
            // if (creep.ticksToLive > (2 + 0.5) * pathLength) { // +0.5 for buffer
            this.collect(creep);
            // } else {
            //     creep.suicide(); // kill off so you don't randomly drop tons of energy everywhere
            // }
        } else {
            this.deposit(creep);
        }
    }

    onRun(creep) {
        // // Migrate from old hauler model
        // creep.assignment = creep.workRoom.storage;
        // creep.task = null;

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

        // Reduce moveTo usage when in non-crowded rooms
        // if (creep.memory.task) {
        //     if (!creep.room.my) {
        //         creep.memory.task.data.moveToOptions = {
        //             ignoreCreeps: true,
        //             reusePath: 40
        //         }
        //     } else {
        //         creep.memory.task.data.moveToOptions = {
        //             ignoreCreeps: false,
        //             reusePath: 15
        //         }
        //     }
        // }
    }

}

module.exports = roleHauler;