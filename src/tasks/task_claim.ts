import {Task} from "./Task";

export class taskClaim extends Task {
    target: StructureController;

    constructor() {
        super('claim');
        // Settings
        this.moveColor = 'purple';
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(CLAIM) > 0);
    }

    isValidTarget() {
        var target = this.target;
        return (target != null && (!target.room || !target.owner));
    }

    work() {
        return this.creep.claimController(this.target);
    }
}
