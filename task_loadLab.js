var Task = require('Task');

class taskLoadLab extends Task {
    constructor() {
        super('loadLab');
        // Settings
        this.maxPerTarget = 1;
        this.moveColor = 'blue';
        this.data.mineralType = null;
    }

    // Assign the task to a creep
    assign(creep, target = null) {
        // add target to Memory.preprocessing
        if (!Memory.preprocessing.targets[target.ref]) {
            Memory.preprocessing.targets[target.ref] = [];
        }
        Memory.preprocessing.targets[target.ref].push(creep.name);
        // register references to creep and target
        this.creep = creep;
        this.target = target;
        this.data.mineralType = target.assignedMineralType;
        creep.memory.task = this;
        this.onAssignment();
        return this.name;
    }

    isValidTask() {
        var creep = this.creep;
        return (creep.carry[this.data.mineralType] > 0);
    }

    isValidTarget() {
        var target = this.target;
        if (target && target.structureType == STRUCTURE_LAB) {
            return (target.mineralAmount < target.mineralCapacity);
        } else {
            return false;
        }
    }

    work() {
        return this.creep.transfer(this.target, this.data.mineralType);
    }
}

module.exports = taskLoadLab;
