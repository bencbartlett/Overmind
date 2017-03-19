var Task = require('Task');

class taskGoTo extends Task {
    constructor() {
        super('goTo');
        // Settings
        this.targetRange = 1;
    }

    isValidTask() {
        return !this.creep.pos.inRangeTo(this.targetPos, this.targetRange);
    }

    isValidTarget() {
        return this.target != null;
    }

    work() {
        return OK;
    }
}

module.exports = taskGoTo;