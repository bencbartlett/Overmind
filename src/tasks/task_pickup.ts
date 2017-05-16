import {Task} from "./Task";

type targetType = Resource
export class taskPickup extends Task {
    target: targetType;

    constructor(target: targetType) {
        super('pickup', target);
        // Settings
        this.maxPerTarget = 1;
        this.moveColor = 'yellow';
    }

    isValidTask() {
        return (this.creep.carry.energy < this.creep.carryCapacity);
    }

    isValidTarget() {
        var target = this.target;
        return (target && target.amount && target.amount > 0);
    }

    work() {
        let res = this.creep.pickup(this.target);
        if (!this.target) { // if the target is gone, we're done and clear the task
            this.creep.task = null;
        }
        return res;
    }
}
