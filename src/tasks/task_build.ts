import {Task} from "./Task";

type targetType = ConstructionSite;

export class taskBuild extends Task {
    target: targetType;
    constructor(target: targetType) {
        super('build', target);
        // Settings
        this.maxPerTarget = 3;
        this.targetRange = 3;
        this.moveColor = 'yellow';
    }

    isValidTask() {
        return (this.creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        if (target) {
            if (target.structureType == STRUCTURE_STORAGE || target.structureType == STRUCTURE_SPAWN) {
                this.maxPerTarget = Infinity; // these things need to be built quickly
            }
            return (target != null && target.my && target.progress < target.progressTotal);
        } else {
            return false;
        }
    }

    work() {
        return this.creep.build(this.target);
    }
}
