var Task = require('Task');

class taskTransfer extends Task {
    constructor() {
        super('transfer');
        // Settings
        this.moveColor = 'blue';
        this.data.resourceType = null; // this needs to be overwritten before assignment
    }

    isValidTask() {
        var creep = this.creep;
        return (creep.carry[this.data.resourceType] > 0);
    }

    isValidTarget() {
        var target = this.target;
        if (target.structureType == STRUCTURE_CONTAINER ||
            target.structureType == STRUCTURE_STORAGE ||
            target.structureType == STRUCTURE_TERMINAL) {
            return (_.sum(target.store) < target.storeCapacity);
        } else if (target.structureType == STRUCTURE_LAB) {
            return target.mineralAmount < target.mineralCapacity;
        } else if (target.structureType == STRUCTURE_NUKER) {
            return target.ghodium < target.ghodiumCapacity
        } else {
            return false;
        }
    }

    work() {
        return this.creep.transfer(this.target, this.data.resourceType);
    }
}

module.exports = taskTransfer;
