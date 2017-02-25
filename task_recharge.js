var Task = require('Task');

class taskRecharge extends Task {
    constructor() {
        super('recharge');
        // Settings
        this.moveColor = 'blue';
        this.data = {
            quiet: false
        };
    }

    isValidTask() {
        var creep = this.creep;
        return (creep.carry.energy < creep.carryCapacity);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.store && target.store[RESOURCE_ENERGY] > 0);
    }

    work() {
        return this.creep.withdraw(this.target, RESOURCE_ENERGY);
    }
}

module.exports = taskRecharge;