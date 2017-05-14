// Linker - transfers energy from link to storage

import {Role} from "./Role";
import {taskRecharge} from "../tasks/task_recharge";
import {taskDeposit} from "../tasks/task_deposit";
import {taskGoTo} from "../tasks/task_goTo";

export class roleLinker extends Role {
    constructor() {
        super('linker');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        this.settings.consoleQuiet = true;
        this.settings.sayQuiet = true;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }

    onCreate(creep: protoCreep): protoCreep {
        creep.memory.data.replaceAt = 100; // replace suppliers early!
        let workRoom = Game.rooms[creep.memory.workRoom];
        let idleFlag = _.filter(workRoom.flags,
                                flag => flagCodes.rally.idlePoint.filter(flag) &&
                                        (flag.memory.role == this.name || flag.name.includes(this.name)))[0];
        if (idleFlag) {
            creep.memory.data.idleFlag = idleFlag.name;
        }
        return creep;
    }

    collect(creep: Creep) {
        var target: Link | StructureStorage | Terminal;
        let storage = creep.colony.storage;
        if (!storage) {
            return "";
        }
        if (storage.links[0].energy > 0) {
            // try targeting non-empty input links
            return creep.assign(new taskRecharge(storage.links[0]));
        } else if (_.sum(storage.store) > creep.colony.overlord.settings.unloadStorageBuffer) {
            // else try unloading from storage into terminal if there is too much energy
            return creep.assign(new taskRecharge(storage));
        } else if (creep.colony.terminal && creep.colony.terminal.store[RESOURCE_ENERGY] >
                                              creep.colony.terminal.brain.settings.resourceAmounts[RESOURCE_ENERGY]
                                              + creep.colony.terminal.brain.settings.excessTransferAmount) {
            // if there is not too much energy in storage and there is too much in terminal, collect from terminal
            return creep.assign(new taskRecharge(creep.colony.terminal));
        }
    }

    deposit(creep: Creep) {
        let storage = creep.colony.storage;
        var target;
        // deposit to storage
        if (storage &&_.sum(storage.store) < creep.colony.overlord.settings.unloadStorageBuffer) {
            target = storage;
        }
        // overwrite and deposit to terminal if not enough energy in terminal and sufficient energy in storage
        let terminal = creep.colony.terminal;
        if (terminal &&
            terminal.store[RESOURCE_ENERGY] < terminal.brain.settings.resourceAmounts[RESOURCE_ENERGY] &&
            storage && storage.store[RESOURCE_ENERGY] > creep.colony.overlord.settings.storageBuffer[this.name]) {
            target = terminal;
        } else if (terminal && storage &&
                   storage.store[RESOURCE_ENERGY] >= creep.colony.overlord.settings.unloadStorageBuffer) {
            target = terminal;
        }
        if (target) {
            return creep.assign(new taskDeposit(target));
        }
    }

    newTask(creep: Creep): void {
        creep.task = null;
        let idleFlag = Game.flags[creep.memory.data.idleFlag];
        if (idleFlag && !creep.pos.inRangeTo(idleFlag, 1)) {
            creep.assign(new taskGoTo(idleFlag));
        } else {
            if (creep.carry.energy == 0) {
                this.collect(creep);
            } else {
                this.deposit(creep);
            }
        }
    }
}
