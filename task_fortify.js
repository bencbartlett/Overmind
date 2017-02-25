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
        var settings = this.creep.room.brain.settings;
        var override = this.creep.room.brain.override;
        var maxHP = settings.fortifyLevel; // global fortify level
        if (override.fortifyLevel[this.creep.room.name]) {
            maxHP = override.fortifyLevel[this.creep.room.name]; // override for certain rooms
        }
        return (target != null && target.hits && target.hits < 1.2 * maxHP); // over-fortify to minimize extra trips
    }

    work() {
        return this.creep.repair(this.target);
    }
}

module.exports = taskFortify;