// Reserver: reserves rooms targeted with a purple/grey flag or claims a room with purple/purple flag

var tasks = require('tasks');
var Role = require('Role');

class roleReserver extends Role {
    constructor() {
        super('reserver');
        // Role-specific settings
        this.settings.bodyPattern = [CLAIM, MOVE];
        this.roleRequirements = creep => creep.getActiveBodyparts(CLAIM) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }

    newTask(creep) {
        if (!creep.assignment.room) {
            creep.assign(tasks('goToRoom'), creep.assignment.roomName);
        } else {
            if (creep.workRoom && creep.workRoom.controller && !creep.workRoom.signedByMe) {
                creep.assign(tasks('signController'), creep.workRoom.controller);
            } else {
                creep.assign(tasks('reserve'), creep.assignment.room.controller);
            }
        }
    }
}

module.exports = roleReserver;