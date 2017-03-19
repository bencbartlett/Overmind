// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage
var tasks = require('tasks');
var Role = require('Role');

class roleSupplier extends Role {
    constructor() {
        super('supplier');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        // this.settings.consoleQuiet = true; // suppliers should shut the fuck up
        this.settings.notifyOnNoRechargeTargets = true;
        this.settings.notifyOnNoTask = false;
        this.roleRequirements = creep => creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    create(spawn, {assignment, workRoom, patternRepetitionLimit = Infinity}) {
        let creep = this.generateLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: patternRepetitionLimit
        });
        creep.memory.data.replaceAt = 100; // replace suppliers early!
        return creep; // spawn.createCreep(creep.body, creep.name, creep.memory);
    }

    // recharge(creep) {
    //     var containers = creep.workRoom.find(FIND_STRUCTURES, {
    //         filter: (s) => s.structureType == STRUCTURE_CONTAINER
    //     });
    //     if (creep.workRoom.storage) {
    //         containers = _.filter(containers, s => s.store[RESOURCE_ENERGY] >
    //                                                this.settings.assistHaulersAtContainerPercent * s.storeCapacity);
    //     }
    //     var target;
    //     if (containers.length > 0) {
    //         let targets = _.sortBy(containers, [function (s) {
    //             return s.store[RESOURCE_ENERGY]
    //         }]);
    //         target = targets[targets.length - 1]; // pick the fullest container
    //     }
    //     if (!target) {
    //         target = creep.workRoom.storage;
    //     }
    //     if (target) {
    //         return creep.assign(tasks('recharge'), target);
    //     } else {
    //         creep.say("Idle");
    //         return null;
    //     }
    // }

    // newTask(creep) {
    //     creep.task = null;
    //     let newTask = this.requestTask(creep);
    //     if (newTask == undefined && creep.carry.energy == 0) {
    //         return this.recharge(creep);
    //     } else {
    //         return newTask;
    //     }
    // }

    run(creep) {
        // move to service room
        if (creep.conditionalMoveToWorkRoom() != OK) {
            return ERR_NOT_IN_SERVICE_ROOM;
        }
        // get new task if this one is invalid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        if (creep.task) {
            // execute task
            this.executeTask(creep);
        } else {
            if (creep.carry.energy < creep.carry.carryCapacity) {
                return this.recharge(creep); // recharge once there's nothing to do
            } else { // sit and wait at flag
                let idleFlag = _.filter(creep.room.flags, require('map_flag_codes').rally.idlePoint.filter)[0];
                if (idleFlag && !creep.pos.inRangeTo(idleFlag, 3)) {
                    // creep.moveToVisual(idleFlag);
                    creep.travelTo(idleFlag);
                }
            }
        }
    }
}


module.exports = roleSupplier;