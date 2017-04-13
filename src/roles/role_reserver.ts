// Reserver: reserves rooms targeted with a purple/grey flag or claims a room with purple/purple flag

import {Role} from "./Role";
// import {tasks} from "../maps/map_tasks";
import {taskGoToRoom} from "../tasks/task_goToRoom";
import {taskSignController} from "../tasks/task_signController";
import {taskReserve} from "../tasks/task_reserve";

export class roleReserver extends Role {
    constructor() {
        super('reserver');
        // Role-specific settings
        this.settings.bodyPattern = [CLAIM, MOVE];
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(CLAIM) > 1 &&
                                                  creep.getActiveBodyparts(MOVE) > 1
    }

    newTask(creep: Creep) {
        if (!creep.assignment.room) {
            creep.assign(new taskGoToRoom(creep.assignment));
        } else {
            if (creep.workRoom && creep.workRoom.controller && !creep.workRoom.signedByMe) {
                creep.assign(new taskSignController(creep.workRoom.controller));
            } else {
                creep.assign(new taskReserve(creep.assignment.room.controller!));
            }
        }
    }
}
