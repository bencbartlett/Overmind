var Task = require('Task');

class taskBuild extends Task {
    constructor() {
        super('build');
        // Settings
        this.maxPerTarget = 3;
        this.targetRange = 3;
        this.moveColor = 'yellow';
    }

    isValidTask() {
        return (this.creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.my && target.progress < target.progressTotal);
    }

    work() {
        return this.creep.build(this.target);
    }
}

module.exports = taskBuild;