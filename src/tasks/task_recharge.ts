import {Task} from "./Task";

type targetType = StructureStorage | StructureContainer | StructureTerminal | StructureLink;
export class taskRecharge extends Task {
    target: targetType;
    constructor(target: targetType) {
        super('recharge', target);
        // Settings
        this.moveColor = 'blue';
    }

    isValidTask() {
        var creep = this.creep;
        return _.sum(creep.carry) < creep.carryCapacity;
    }

    isValidTarget() {
        return this.target && this.target.energy > 0;
    }

    work() {
        return this.creep.withdraw(this.target, RESOURCE_ENERGY);
    }
}
