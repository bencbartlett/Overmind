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

    // create(spawn, {
    //     assignment = 'needs (flagged) assignment',
    //     workRoom = spawn.roomName, // change default for workRoom to origin, not assignment room
    //     patternRepetitionLimit = Infinity
    // }) {
    //     return this.generateLargestCreep(spawn, {
    //         assignment: assignment,
    //         workRoom: workRoom,
    //         patternRepetitionLimit: patternRepetitionLimit
    //     });
    // }

    collect(creep) {
        if (!creep.assignment.room) { // if you don't have vision of the room
            return creep.moveToVisual(creep.assignment.pos, 'blue');
        }
        // if you do have vision, go ahead and target the relevant container
        var nearbyContainers = creep.assignment.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER &&
                           s.store[RESOURCE_ENERGY] > creep.carry.carryCapacity
        });
        // target fullest of nearby containers
        var target = _.sortBy(nearbyContainers,
                              container => container.store[RESOURCE_ENERGY])[nearbyContainers.length - 1];
        if (!target) { // if it can't bring a full load, target the fullest container in the room
            let allContainers = creep.assignment.room.containers;
            target = _.sortBy(allContainers, c => c.store[RESOURCE_ENERGY])[allContainers.length - 1];
        }
        if (target) {
            var collect = tasks('recharge');
            // collect.data.moveToOptions = {
            //     ignoreCreeps: false,
            //     reusePath: 10
            // };
            creep.assign(collect, target);
        } else {
            creep.log("no collect target!");
        }

    }

    deposit(creep) {
        var target = creep.workRoom.storage;
        if (target) {
            var deposit = tasks('deposit');
            // deposit.data.moveToOptions = {
            //     ignoreCreeps: false,
            //     reusePath: 10
            // };
            creep.assign(deposit, target);
        } else {
            creep.log("no storage in " + creep.workRoom.name);
        }
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
        // Pickup any dropped energy along your route
        let droppedEnergy = creep.pos.findInRange(FIND_DROPPED_ENERGY, 1);
        if (droppedEnergy.length > 0) {
            creep.pickup(droppedEnergy[0]);
        }
        // // Reduce moveTo usage when in non-crowded rooms
        // if (creep.task) {
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