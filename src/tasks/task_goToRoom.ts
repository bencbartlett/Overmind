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

    // // Getter/setter for task.targetPos
    // get targetPos(): RoomPosition {
    //     // console.log(this.targetCoords.x, this.targetCoords.y, this.targetCoords.roomName)
    //     return new RoomPosition(this.targetCoords.x, this.targetCoords.y, this.targetCoords.roomName);
    // }
    //
    // set targetPos(roomName: string) {
    //     this.targetCoords.x = 25;
    //     this.targetCoords.y = 25;
    //     this.targetCoords.roomName = roomName;
    // }

    // setTargetPos(roomName: string) {
    //     this.targetCoords.x = 25;
    //     this.targetCoords.y = 25;
    //     this.targetCoords.roomName = roomName;
    // }

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
