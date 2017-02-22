var Task = require('Task');

class taskUpgrade extends Task {
    constructor() {
        super('upgrade');
        // Settings
        this.targetRange = 3;
        this.moveColor = 'purple';
        this.data = {
            quiet: true
        };
    }

    isValidTask() {
        return (this.creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.structureType == STRUCTURE_CONTROLLER && target.my);
    }

    work() {
        return this.creep.upgradeController(this.target);
    }
}

module.exports = taskUpgrade;