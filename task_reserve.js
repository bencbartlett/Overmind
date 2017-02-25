var Task = require('Task');

class taskReserve extends Task {
    constructor() {
        super('reserve');
        // Settings
        this.moveColor = 'purple';
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(CLAIM) > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && (!target.reservation || target.reservation.ticksToEnd < 4999 ));
    }

    work() {
        return this.creep.reserveController(this.target);
    }
}

module.exports = taskReserve;
