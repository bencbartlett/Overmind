var Task = require('Task');

class taskGoToRoom extends Task {
    constructor() {
        super('goToRoom');
        // Settings
        this.targetRange = 50;
    }

    isValidTask() {
        return !this.creep.inSameRoomAs(this.targetPos);
    }

    isValidTarget() {
        return this.target != null;
    }

    work() {
        return OK;
    }
}

module.exports = taskGoToRoom;