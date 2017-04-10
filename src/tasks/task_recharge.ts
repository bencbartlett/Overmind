import {Task} from "./Task";

export class taskRecharge extends Task {
    target: StructureStorage | StructureContainer;
    constructor() {
        super('recharge');
        // Settings
        this.moveColor = 'blue';
    }

    isValidTask() {
        var creep = this.creep;
        return (_.sum(creep.carry) < creep.carryCapacity);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.store && target.store[RESOURCE_ENERGY] > 0);
    }

    work() {
        return this.creep.withdraw(this.target, RESOURCE_ENERGY);
    }
}
