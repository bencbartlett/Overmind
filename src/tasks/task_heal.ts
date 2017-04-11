import {Task} from "./Task";

type targetType = Creep;
export class taskHeal extends Task {
    target: targetType;
    constructor(target: targetType) {
        super('heal', target);
        // Settings
        this.moveColor = 'green';
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(HEAL) > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target && target.hits && target.hits < target.hitsMax && target.my == true);
    }

    work() {
        var creep = this.creep;
        var target = this.target;
        if (creep.pos.isNearTo(target)) {
            return creep.heal(target);
        }
        if (creep.pos.inRangeTo(target, 3)) {
            return creep.rangedHeal(target);
        }
    }
}

