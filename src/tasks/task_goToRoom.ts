import {Task} from "./Task";

type targetType = RoomObject;
export class taskGoToRoom extends Task {
    target: targetType;

    constructor(target: targetType) {
        super('goToRoom', target);
        // Settings
        // this.targetRange = 22;
        // this.setTargetPos(target.roomName);
    }

    isValidTask() {
        let creep = this.creep;
        return !(creep.pos.roomName == this.target.roomName &&
                 creep.pos.x > 0 && creep.pos.x < 49 &&
                 creep.pos.y > 0 && creep.pos.y < 49);
    }

    isValidTarget() {
        return true;
    }

    work() {
        return OK;
    }
}
