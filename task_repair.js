var Task = require('Task');

class taskRepair extends Task {
    constructor() {
        super('repair');
        // Settings
        this.maxPerTarget = 1;
        this.targetRange = 3;
        this.moveColor = 'green';
    }

    isValidTask() {
        return (this.creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.hits && target.hits < target.hitsMax);
    }

    work() {
        return this.creep.repair(this.target);
    }
}

module.exports = taskRepair;
