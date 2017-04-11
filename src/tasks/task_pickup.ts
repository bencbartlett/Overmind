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
        return (target != null && target.amount != null && target.amount > 0);
    }

    work() {
        return this.creep.pickup(this.target);
    }
}
