var Task = require('Task');

class taskDeposit extends Task {
    constructor() {
        super('deposit');
        // Settings
        this.moveColor = 'blue';
        this.data.quiet = true;
    }

    isValidTask() {
        var creep = this.creep;
        return (creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        if (target.structureType == STRUCTURE_CONTAINER ||
            target.structureType == STRUCTURE_STORAGE) {
            return (_.sum(target.store) < target.storeCapacity);
        } else if (target.structureType == STRUCTURE_LINK) {
            return target.energy < target.storeCapacity;
        } else {
            return false;
        }
    }

    work() {
        return this.creep.transfer(this.target, RESOURCE_ENERGY);
    }
}

module.exports = taskDeposit;
