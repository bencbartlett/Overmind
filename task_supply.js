var Task = require('Task');

class taskSupply extends Task {
    constructor() {
        super('supply');
        // Settings
        this.maxPerTarget = 1;
        this.moveColor = 'blue';
        this.data = {
            quiet: true
        }
    }

    isValidTask() {
        var creep = this.creep;
        return (creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        if (target.structureType == STRUCTURE_SPAWN ||
            target.structureType == STRUCTURE_EXTENSION ||
            target.structureType == STRUCTURE_TOWER) {
            return (target.energy < target.energyCapacity);
        } else {
            return false;
        }
    }

    work() {
        return this.creep.transfer(this.target, RESOURCE_ENERGY);
    }
}

module.exports = taskSupply;
