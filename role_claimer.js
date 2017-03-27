// Reserver: reserves rooms targeted with a purple/grey flag or claims a room with purple/purple flag

var tasks = require('tasks');
var Role = require('Role');

class roleClaimer extends Role {
    constructor() {
        super('claimer');
        // Role-specific settings
        this.settings.bodyPattern = [CLAIM, MOVE];
        this.roleRequirements = creep => creep.getActiveBodyparts(CLAIM) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }

    newTask(creep) {
        if (!creep.assignment.room) {
            creep.assign(tasks('goToRoom'), creep.assignment);
        } else {
            if (creep.workRoom && creep.workRoom.controller && !creep.workRoom.signedByMe) {
                creep.assign(tasks('signController'), creep.workRoom.controller);
            } else {
                creep.assign(tasks('claim'), creep.assignment.room.controller);
            }
        }
    }
}

module.exports = roleClaimer;