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

    onCreate(creep) {
        creep.memory.data.replaceAt = 100; // replace suppliers early!
        let workRoom = Game.rooms[creep.memory.workRoom];
        let idleFlag = _.filter(workRoom.flags,
                                flag => require('map_flag_codes').rally.idlePoint.filter(flag) &&
                                        (flag.memory.role == this.name || flag.name.includes(this.name)))[0];
        if (idleFlag) {
            creep.memory.data.idleFlag = idleFlag.name;
        }
        return creep;
    }

    recharge(creep) { // default recharging logic for creeps
        // try to find closest container or storage
        var bufferSettings = creep.room.brain.settings.storageBuffer; // not creep.workRoom; use rules of room you're in
        var buffer = bufferSettings.default;
        if (bufferSettings[this.name]) {
            buffer = bufferSettings[this.name];
        }
        var target = creep.pos.findClosestByRange(creep.room.storageUnits, {
            filter: (s) => (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
                           (s.structureType == STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > buffer)
        });
        if (!target) {
            target = creep.room.terminal; // energy should be sent to room if it is out
        }
        if (target) { // assign recharge task to creep
            return creep.assign(tasks('recharge'), target);
        } else {
            if (!this.settings.consoleQuiet && this.settings.notifyOnNoRechargeTargets) {
                creep.log('no recharge targets!');
            }
            return null;
        }
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
                let idleFlag = Game.flags[creep.memory.data.idleFlag];
                if (idleFlag && !creep.pos.inRangeTo(idleFlag, 1)) {
                    creep.travelTo(idleFlag);
                }
            }
        }
    }
}


module.exports = roleSupplier;