import {Task} from "./Task";

type targetType = StructureStorage | Container | Terminal | Link;
export class taskRecharge extends Task {
    target: targetType;
    constructor(target: targetType) {
        super('recharge', target);
        // Settings
        this.moveColor = 'blue';
    }

    isValidTask() {
        var creep = this.creep;
        return (_.sum(creep.carry) < creep.carryCapacity);
    }

    isValidTarget() {
        var target = this.target;
        if (target instanceof StructureLink) {
            return target.energy > 0;
        } else {
            return target.store && target.store[RESOURCE_ENERGY] > 0;
        }
    }

    work() {
        return this.creep.withdraw(this.target, RESOURCE_ENERGY);
    }
}
