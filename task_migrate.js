var Task = require('Task');

class taskMigrate extends Task {
    constructor() {
        super('migrate');
        // Settings
    }

    isValidTask() {
        return false; //(this.creep.room != this.target.room);
    }

    isValidTarget() {
        return false; //(this.target != null);
    }

    work() {
        return OK;
    }
}

module.exports = taskMigrate;
