// Scout - grants vision in reserved rooms

import {Role} from "./Role";

export class roleScout extends Role {
    constructor() {
        super('scout');
        // Role-specific settings
        this.settings.bodyPattern = [MOVE];
        this.roleRequirements = creep => creep.getActiveBodyparts(MOVE) > 1
    }

    create(spawn, {assignment, workRoom = null, patternRepetitionLimit = 1}) {
        if (!workRoom) {
            workRoom = assignment.roomName;
        }
        let creep = this.generateLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: patternRepetitionLimit
        });
        return creep; // spawn.createCreep(creep.body, creep.name, creep.memory);
    }

    run(creep) {
        if (creep.assignment) {
            if (!creep.pos.inRangeTo(creep.assignment.pos, 0)) {
                creep.travelTo(creep.assignment);
            } else if (creep.memory.data.replaceAt == 0) {
                creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 50;
            }
        }
    }

}
