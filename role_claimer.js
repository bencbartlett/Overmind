// Reserver: reserves rooms targeted with a purple/grey flag or claims a room with purple/purple flag

var tasks = require('tasks');
var Role = require('Role');

class roleClaimer extends Role {
    constructor() {
        super('claimer');
        // Role-specific settings
        this.settings.bodyPattern = [CLAIM, MOVE];
        this.settings.signature = controllerSignature;
        this.roleRequirements = creep => creep.getActiveBodyparts(CLAIM) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }

    newTask(creep) {
        creep.task = null;
        if (!creep.assignment.room) {
            creep.moveToVisual(creep.assignment, 'purple'); // TODO: make a moveToRoom task
        } else {
            creep.assign(tasks('claim'), creep.assignment.room.controller);
        }
    }

    onRun(creep) {
        // if (creep.pos.inRangeTo(creep.assignment.pos, 3) && creep.memory.data.replaceAt == 0) {
        //     creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive);
        // }
        if (creep.workRoom && (!creep.workRoom.controller.sign ||
                               creep.workRoom.controller.sign.text != this.settings.signature)) {
            if (creep.signController(creep.workRoom.controller, this.settings.signature) == ERR_NOT_IN_RANGE) {
                creep.moveToVisual(creep.workRoom.controller);
            }
        }
    }
}

module.exports = roleClaimer;