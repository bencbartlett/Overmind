var Task = require('Task');

class taskUpgrade extends Task {
    constructor() {
        super('upgrade');
        // Settings
        this.targetRange = 3;
        this.moveColor = 'purple';
        this.data = {
            quiet: true,
            publicMessage: ["For", "the", "swarm!"]
        };
    }

    isValidTask() {
        return (this.creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.structureType == STRUCTURE_CONTROLLER && target.my);
    }

    work() {
        this.creep.publicMessage(["For", "the swarm!", "(and GCL)"]);
        let result = this.creep.upgradeController(this.target);
    }
}

module.exports = taskUpgrade;