// Linker - transfers energy from link to storage

import {Role} from "./Role";
// import {tasks} from "../maps/map_tasks";
import {taskWithdraw} from "../tasks/task_withdraw";
import {taskTransfer} from "../tasks/task_transfer";

export class roleMineralSupplier extends Role {
    constructor() {
        super('mineralSupplier');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        this.settings.consoleQuiet = true;
        this.settings.sayQuiet = true;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }

    collectForLab(creep: Creep, lab: Lab) {
        if (creep.workRoom.terminal.store[lab.assignedMineralType] == 0) {
            return OK;
        } else {
            var withdrawThis = new taskWithdraw(creep.workRoom.terminal);
            withdrawThis.data.resourceType = lab.assignedMineralType;
            return creep.assign(withdrawThis);
        }
    }

    depositForLab(creep: Creep, lab: Lab) {
        var transfer = new taskTransfer(lab);
        transfer.data.resourceType = lab.assignedMineralType;
        return creep.assign(transfer);
    }

    newTask(creep: Creep) {
        creep.task = null;
        let loadLabs = _.filter(creep.room.labs,
                                (lab: StructureLab) => lab.IO == 'in' &&
                                                       lab.mineralAmount < lab.maxAmount - creep.carryCapacity);
        if (loadLabs.length > 0) {
            let lab = loadLabs[0];
            if (_.sum(creep.carry) == 0) {
                this.collectForLab(creep, lab);
            } else {
                this.depositForLab(creep, lab);
            }
        }
    }

    onRun(creep: Creep) {
        if (creep.ticksToLive < 100 && _.sum(creep.carry) == 0) {
            creep.suicide();
        }
    }
}
