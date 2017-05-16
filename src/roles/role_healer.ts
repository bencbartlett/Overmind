// RallyHealer - meant to complement sieger. Sits in adjacent room to fortified target room and heals damaged siegers

import {Role} from "./Role";
// import {tasks} from "../maps/map_tasks";
import {taskHeal} from "../tasks/task_heal";

export class roleHealer extends Role {
    constructor() {
        super('rallyHealer');
        // Role-specific settings
        this.settings.bodyPattern = [HEAL, MOVE];
        this.settings.bodyPrefix = [TOUGH, TOUGH, TOUGH];
        this.settings.proportionalPrefixSuffix = false;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(HEAL) > 1 &&
                                                  creep.getActiveBodyparts(MOVE) > 1
    }


    findTarget(creep: Creep): Creep | void {
        var target;
        var targetPriority = [
            () => creep.pos.findClosestByRange(FIND_MY_CREEPS, {filter: (c: Creep) => c.getBodyparts(HEAL) > 0}),
            () => creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (c: Creep) => c.getBodyparts(ATTACK) > 0 || c.getBodyparts(RANGED_ATTACK) > 0,
            }),
            () => creep.pos.findClosestByRange(FIND_MY_CREEPS),
        ];
        for (let targetThis of targetPriority) {
            target = targetThis() as Creep;
            if (target) {
                return target;
            }
        }
    }


    run(creep: Creep) {
        var assignment = Game.flags[creep.memory.assignment];
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            creep.task = null;
            var target = this.findTarget(creep);
            if (target) {
                creep.assign(new taskHeal(target));
            }
        }
        if (creep.task) {
            return creep.task.step();
        }
        if (assignment) {
            if (!creep.task) {
                creep.travelTo(assignment);
            }
        }
    }
}
