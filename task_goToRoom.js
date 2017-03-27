var Task = require('Task');

class taskGoToRoom extends Task {
    constructor() {
        super('goToRoom');
        // Settings
        this.targetRange = 23;
    }

    // Getter/setter for task.targetPos
    get targetPos() {
        return new RoomPosition(this.targetCoords.x, this.targetCoords.y, this.targetCoords.roomName);
    }

    set targetPos(roomName) {
        this.targetCoords.x = 25;
        this.targetCoords.y = 25;
        this.targetCoords.roomName = roomName;
    }

    // Assign the task to a creep
    assign(creep, roomName = 'roomNameString') {
        // // add target to Memory.preprocessing
        // if (!Memory.preprocessing.targets[target.ref]) {
        //     Memory.preprocessing.targets[target.ref] = [];
        // }
        // Memory.preprocessing.targets[target.ref].push(creep.name);
        // register references to creep and target
        this.creep = creep;
        this.targetID = null;
        this.targetPos = roomName;
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

module.exports = taskGoToRoom;