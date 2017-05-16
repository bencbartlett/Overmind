// Scout - grants vision in reserved rooms

import {Role} from "./Role";

export class roleScout extends Role {
    constructor() {
        super('scout');
        // Role-specific settings
        this.settings.bodyPattern = [MOVE];
        this.roleRequirements = (c: Creep) => c.getActiveBodyparts(MOVE) > 1
    }

    run(creep: Creep) {
        if (creep.assignment) {
            if (!creep.pos.inRangeTo(creep.assignment.pos, 0)) {
                creep.travelTo(creep.assignment);
            }
        }
    }

}
