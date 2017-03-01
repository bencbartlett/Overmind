var Task = require('Task');

class taskAttack extends Task {
    constructor() {
        super('rangedAtack');
        // Settings
        this.moveColor = 'red';
        this.targetRange = 3;
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(ATTACK) > 0 && (this.creep.room.hostiles.length > 0 ||
                                                              this.creep.room.hostileStructures.length > 0));
    }

    isValidTarget() {
        var target = this.target;
        return (target && target.hits && target.hits > 0 && target.my == false);
    }

    work() {
        return this.creep.attack(this.target);
    }
}

module.exports = taskAttack;
