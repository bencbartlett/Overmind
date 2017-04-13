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
        let carry = this.creep.carry[this.data.mineralType];
        if (carry) {
            return carry > 0;
        } else {
            return false;
        }
    }

    isValidTarget() {
        let target = this.target;
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
