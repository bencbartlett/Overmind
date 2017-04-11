import {Task} from "./Task";

type targetType = Source;
export class taskHarvest extends Task {
    target: targetType;

    constructor(target: targetType) {
        super('harvest', target);
        // Settings
        this.moveColor = 'yellow';
    }

    isValidTask() {
        var creep = this.creep;
        return (creep.carry.energy < creep.carryCapacity);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && target.energy != null && target.energy > 0);
    }

    work() {
        return this.creep.harvest(this.target);
    }
}
