import {Task} from "./Task";

type targetType = Lab;
export class taskLoadLab extends Task {
    target: targetType;

    constructor(target: targetType) {
        super('loadLab', target);
        // Settings
        this.maxPerTarget = 1;
        this.moveColor = 'blue';
        this.data.mineralType = this.target.assignedMineralType;
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
