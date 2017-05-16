// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage

import {Role} from "./Role";
import {taskRecharge} from "../tasks/task_recharge";

export class roleSupplier extends Role {
    constructor() {
        super('supplier');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        // this.settings.consoleQuiet = true; // suppliers should shut the fuck up
        this.settings.notifyOnNoRechargeTargets = true;
        this.settings.notifyOnNoTask = false;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }

    onCreate(creep: protoCreep) {
        let colonyRoom = Game.rooms[creep.memory.colony];
        let idleFlag = _.filter(colonyRoom.flags,
                                flag => flagCodes.rally.idlePoint.filter(flag) &&
                                        (flag.memory.role == this.name || flag.name.includes(this.name)))[0];
        if (idleFlag) {
            creep.memory.data.idleFlag = idleFlag.name;
        }
        return creep;
    }

    recharge(creep: Creep) { // default recharging logic for creeps
        // try to find closest container or storage
        var bufferSettings = creep.colony.overlord.settings.storageBuffer; // not creep.workRoom; use rules of room you're in
        var buffer = bufferSettings.default;
        if (bufferSettings[this.name]) {
            buffer = bufferSettings[this.name];
        }
        var target: Container | Storage | Terminal;
        target = creep.pos.findClosestByRange(creep.room.storageUnits, {
            filter: (s: Storage | Container) =>
            (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
            (s.structureType == STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > buffer),
        }) as Storage | Container;
        if (!target && creep.room.terminal) {
            target = creep.room.terminal; // energy should be sent to room if it is out
        }
        if (target) { // assign recharge task to creep
            return creep.assign(new taskRecharge(target));
        } else {
            if (!this.settings.consoleQuiet && this.settings.notifyOnNoRechargeTargets) {
                creep.log('no recharge targets!');
            }
            return "";
        }
    }

    run(creep: Creep) {
        // get new task if this one is invalid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        if (creep.task) {
            // execute task
            this.executeTask(creep);
        } else {
            if (creep.carry.energy < creep.carryCapacity) {
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

