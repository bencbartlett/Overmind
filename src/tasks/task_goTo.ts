import {Task} from "./Task";

export class taskGoTo extends Task {
    target: RoomObject;

    constructor() {
        super('goTo');
        // Settings
        this.targetRange = 1;
    }

    isValidTask() {
        return !this.creep.pos.inRangeTo(this.targetPos, this.targetRange);
    }

    isValidTarget() {
        return this.target != null;
    }

    work() {
        return OK;
    }
}
