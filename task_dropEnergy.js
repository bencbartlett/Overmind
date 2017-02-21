var Task = require('Task');

class taskDropEnergy extends Task {
    constructor() {
        super('dropEnergy');
        // Settings
    }

    get target() { // lots of overrides because this is an unusual targetless task
        return null;
    }

    set target(target) {
        return null;
    }

    onAssignment() {
        this.creep.say("drop");
    }

    isValidTask() {
        return (this.creep.carry.energy > 0);
    }

    step() {
        return this.work();
    }

    work() {
        return this.creep.drop(RESOURCE_ENERGY);
    }
}

module.exports = taskDropEnergy;
