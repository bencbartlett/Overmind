var Task = require('Task');

class taskFortify extends Task {
    constructor() {
        super('fortify');
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
        var maxHP = this.creep.room.brain.settings.fortifyLevel;
        return (target != null && target.hits && target.hits < maxHP);
    }

    work() {
        return this.creep.repair(this.target);
    }
}

module.exports = taskFortify;