var Task = require('Task');

class taskReserve extends Task {
    constructor() {
        super('claim');
        // Settings
        this.moveColor = 'purple';
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(CLAIM) > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && (!target.room || !target.owner));
    }

    work() {
        return this.creep.claimController(this.target);
    }
}

module.exports = taskReserve;
