var Task = require('Task');

class taskGetBoosted extends Task {
    constructor() {
        super('getBoosted');
        // Settings
        this.moveColor = 'cyan';
    }

    isValidTask() {
        return !(this.creep.memory.boosted && this.creep.memory.boosted[this.target.mineralType]);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.my && target.structureType == STRUCTURE_LAB);
    }

    work() {
        let response = this.target.boostCreep(this.creep);
        if (response == OK) {
            if (!this.creep.memory.boosted) {
                this.creep.memory.boosted = {};
            }
            this.creep.memory.boosted[this.target.mineralType] = true;
            this.creep.log('Boosted successfully!');
        }
        return response;
    }
}

module.exports = taskGetBoosted;
