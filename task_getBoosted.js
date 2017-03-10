var Task = require('Task');

class taskGetBoosted extends Task {
    constructor() {
        super('getBoosted');
        // Settings
        this.moveColor = 'cyan';
    }

    isValidTask() {
        return this.creep.ticksToLive > 0.9 * this.creep.lifetime && !this.creep.memory.boosted;
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.my && target.structureType == STRUCTURE_LAB);
    }

    work() {
        let response = this.target.boostCreep(this.creep);
        if (response == OK) {
            this.creep.memory.boosted = true;
            this.creep.log('Boosted successfully!');
        }
        return response;
    }
}

module.exports = taskGetBoosted;
