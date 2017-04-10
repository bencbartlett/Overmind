import {Task} from "./Task";

export class taskGoToRoom extends Task {
    constructor() {
        super('goToRoom');
        // Settings
        this.targetRange = 22;
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

    setTargetPos(roomName: string) {
        this.targetCoords.x = 25;
        this.targetCoords.y = 25;
        this.targetCoords.roomName = roomName;
    }

    // Assign the task to a creep
    assign(creep: Creep, target: RoomObject) {
        // register references to creep and target
        this.creep = creep;
        this.targetID = null;
        this.setTargetPos(target.roomName);
        creep.memory.task = this; // serializes the searalizable portions of the task into memory
        this.onAssignment();
        return this.name;
    }

    isValidTask() {
        return !this.creep.pos.inRangeTo(this.targetPos, this.targetRange);
    }

    isValidTarget() {
        return true;
    }

    work() {
        return OK;
    }
}
