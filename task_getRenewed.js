var Task = require('Task');

class taskReserve extends Task {
    constructor() {
        super('getRenewed');
        // Settings
        this.moveColor = 'purple';
    }

    isValidTask() {
        return (this.creep.hits < this.creep.hitsMax);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.my && target.structureType == STRUCTURE_SPAWN);
    }

    work() {
        let response =  this.target.renewCreep(this.Creep);
        creep.log("Renewing!" + response);
        return response;
    }
}

module.exports = taskReserve;
