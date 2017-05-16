// Reserver: reserves rooms targeted with a purple/grey flag or claims a room with purple/purple flag

import {Role} from "./Role";
// import {tasks} from "../maps/map_tasks";
import {taskGoToRoom} from "../tasks/task_goToRoom";
import {taskSignController} from "../tasks/task_signController";
import {taskClaim} from "../tasks/task_claim";

export class roleClaimer extends Role {
    constructor() {
        super('claimer');
        // Role-specific settings
        this.settings.bodyPattern = [CLAIM, MOVE];
        this.roleRequirements = (c: Creep) => c.getActiveBodyparts(CLAIM) > 1 &&
                                              c.getActiveBodyparts(MOVE) > 1
    }

    newTask(creep: Creep) {
        if (!creep.assignment.room) {
            creep.assign(new taskGoToRoom(creep.assignment));
        } else {
            let controller = creep.assignment.room.controller;
            if (controller.signedByMe) {
                creep.assign(new taskSignController(controller));
            } else {
                creep.assign(new taskClaim(controller));
            }
        }
    }
}