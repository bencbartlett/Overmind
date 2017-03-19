// Linker - transfers energy from link to storage

var tasks = require('tasks');
var Role = require('Role');

class roleMineralSupplier extends Role {
    constructor() {
        super('mineralSupplier');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        this.settings.consoleQuiet = true;
        this.settings.sayQuiet = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    collectForLab(creep, lab) {
        var withdrawThis = tasks('withdraw');
        withdrawThis.data.resourceType = lab.assignedMineralType;
        if (creep.workRoom.terminal.store[lab.assignedMineralType] == 0) {
            return OK;
        } else {
            return creep.assign(withdrawThis, creep.workRoom.terminal);
        }
    }

    depositForLab(creep, lab) {
        var transfer = tasks('transfer');
        transfer.data.resourceType = lab.assignedMineralType;
        return creep.assign(transfer, lab);
    }

    newTask(creep) {
        creep.task = null;
        let loadLabs = _.filter(creep.room.labs, lab => lab.IO == 'in' &&
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

    onRun(creep) {
        if (creep.ticksToLive < 100 && _.sum(creep.carry) == 0) {
            creep.suicide();
        }
    }
}

module.exports = roleMineralSupplier;