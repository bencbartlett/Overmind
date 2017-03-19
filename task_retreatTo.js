var Task = require('Task');

class taskRetreatTo extends Task {
    constructor() {
        super('retreatTo');
        // Settings
        this.targetRange = 1;
        this.moveColor = 'green';
    }

    isValidTask() {
        return !this.creep.pos.inRangeTo(this.targetPos, this.targetRange) && this.creep.hits == this.creep.hitsMax;
    }

    isValidTarget() {
        return this.target != null;
    }

    work() {
        return OK;
    }
}

module.exports = taskRetreatTo;