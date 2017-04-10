import {Task} from "./Task";

export class taskWithdraw extends Task {
    target: StructureStorage | StructureContainer | StructureTerminal;

    constructor() {
        super('withdraw');
        // Settings
        this.moveColor = 'blue';
        this.data.resourceType = null; // this needs to be overwritten on assignment
    }

    isValidTask() {
        var creep = this.creep;
        return (_.sum(creep.carry) < creep.carryCapacity);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.store && target.store[this.data.resourceType] > 0);
    }

    work() {
        return this.creep.withdraw(this.target, this.data.resourceType);
    }
}
