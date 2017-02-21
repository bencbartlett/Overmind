var Task = require('Task');

class taskTransferEnergy extends Task {
    constructor() {
        super('transferEnergy');
        // Settings
        this.moveColor = 'blue';
    }

    isValidTask() {
        var creep = this.creep;
        return (creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        if (target.structureType == STRUCTURE_LINK) {
            return target.energy < target.storeCapacity * 0.85;
        } else if (target.structureType == STRUCTURE_CONTAINER || STRUCTURE_STORAGE) {
            return (_.sum(target.store) < target.storeCapacity);
        }
    }

    work() {
        return this.creep.transfer(this.target, RESOURCE_ENERGY);
    }
}

module.exports = taskTransferEnergy;
