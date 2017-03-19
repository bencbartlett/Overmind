var Task = require('Task');
var flagCodes = require('map_flag_codes');

class taskDismantle extends Task {
    constructor() {
        super('dismantle');
        // Settings
        this.maxPerTarget = 3;
        this.moveColor = 'red';
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(WORK) > 0);
    }

    isValidTarget() {
        let target = this.target;
        return target && target.hits && target.hits > 0;
        // let isValid = (target && target.hits && target.hits > 0 || target && target.room == undefined);
        // // remove dismantle flags if done
        // if (!isValid && this.data.targetFlag && this.data.targetX && this.data.targetY && this.data.targetRoomName) {
        //     //noinspection JSCheckFunctionSignatures
        //     let targetPos = new RoomPosition(this.data.targetX, this.data.targetY, this.data.targetRoomName);
        //     if (this.creep.inSameRoomAs(targetPos) && targetPos.flaggedWith(flagCodes.destroy.dismantle.filter)) {
        //         for (let flag of _.filter(targetPos.lookFor(LOOK_FLAGS), flagCodes.destroy.dismantle.filter)) {
        //             flag.remove();
        //         }
        //     }
        // }
        // return isValid;
    }

    work() {
        return this.creep.dismantle(this.target);
    }
}

module.exports = taskDismantle;