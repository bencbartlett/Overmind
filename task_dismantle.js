var Task = require('Task');
var flagCodes = require('map_flag_codes');

class taskDismantle extends Task {
    constructor() {
        super('dismantle');
        // Settings
        this.maxPerTarget = 3;
        this.targetRange = 1;
        this.moveColor = 'red';
        this.data = {
            targetFlag: true,
            targetX: null,
            targetY: null,
            targetRoomName: null
        }
    }

    get target() { // target can be a structure or a flag
        if (deref(this.targetID) == null) {
            return null;
        }
        if (this.data.targetFlag) { // if you're targeting a flag
            if (deref(this.targetID).room == undefined) { // if room is invisible
                return deref(this.targetID); // return flag
            } else {
                return deref(this.targetID).pos.lookFor(LOOK_STRUCTURES)[0]; // return object flag is sitting on
            }
        } else {
            return deref(this.targetID); // return object; can't be used in invisible rooms
        }
    }

    set target(target) { // custom setter - saves target position so it can remove flag later
        this.targetID = target.id || target.name || null;
        if (target.pos) {
            if (target.id && Game.getObjectById(target.id)) { // if object is the targeted thing
                this.data.targetFlag = false;
            }
            this.data.targetX = target.pos.x;
            this.data.targetY = target.pos.y;
            this.data.targetRoomName = target.room.name;
        }
    }

    isValidTask() {
        return (this.creep.getActiveBodyparts(WORK) > 0);
    }

    isValidTarget() {
        let target = this.target;
        let isValid = (target && target.hits && target.hits > 0 || target && target.room == undefined);
        // remove dismantle flags if done
        if (!isValid && this.data.targetFlag && this.data.targetX && this.data.targetY && this.data.targetRoomName) {
            //noinspection JSCheckFunctionSignatures
            let targetPos = new RoomPosition(this.data.targetX, this.data.targetY, this.data.targetRoomName);
            if (this.creep.inSameRoomAs(targetPos) && targetPos.flaggedWith(flagCodes.destroy.dismantle.filter)) {
                for (let flag of _.filter(targetPos.lookFor(LOOK_FLAGS), flagCodes.destroy.dismantle.filter)) {
                    flag.remove();
                }
            }
        }
        return isValid;
    }

    work() {
        return this.creep.dismantle(this.target);
    }
}

module.exports = taskDismantle;