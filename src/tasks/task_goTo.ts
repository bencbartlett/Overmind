import {Task} from "./Task";

type targetType = RoomObject;
export class taskGoTo extends Task {
    target: targetType;
    constructor(target: targetType) {
        super('goTo', target);
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
