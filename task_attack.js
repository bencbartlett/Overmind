var Task = require('Task');

// Attack task, includes attack and ranged attack if applicable.
// Use meleeAttack and rangedAttack for the exclusive variants.

class taskAttack extends Task {
    constructor() {
        super('attack');
        // Settings
        this.moveColor = 'red';
        this.targetRange = 3; // for minimum of meleeAttack
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
        var creep = this.creep;
        var target = this.target;
        var attackReturn, rangedAttackReturn;
        if (creep.pos.isNearTo(target) && creep.getActiveBodyparts(ATTACK) > 0) {
            attackReturn = creep.attack(target);
        }
        if (creep.pos.inRangeTo(target, 3) && creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
            rangedAttackReturn = creep.rangedAttack(target);
        }
        if (attackReturn == OK && rangedAttackReturn == OK) {
            return OK;
        }
        return rangedAttackReturn || attackReturn; // if one of them is !OK
    }
}

module.exports = taskAttack;
