// RallyHealer - meant to complement sieger. Sits in adjacent room to fortified target room and heals damaged siegers

var tasks = require('tasks');
var Role = require('Role');

class roleHealer extends Role {
    constructor() {
        super('rallyHealer');
        // Role-specific settings
        this.settings.bodyPattern = [HEAL, MOVE];
        this.settings.bodyPrefix = [TOUGH, TOUGH, TOUGH];
        this.settings.proportionalPrefixSuffix = false;
        this.roleRequirements = creep => creep.getActiveBodyparts(HEAL) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }


    findTarget(creep) {
        var target;
        var targetPriority = [
            () => creep.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.getBodyparts(HEAL) > 0}),
            () => creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: c => c.getBodyparts(ATTACK) > 0 || c.getBodyparts(RANGED_ATTACK) > 0
            }),
            () => creep.pos.findClosestByRange(FIND_MY_CREEPS),
        ];
        for (let targetThis of targetPriority) {
            target = targetThis();
            if (target) {
                return target;
            }
        }
        return null;
    }


    run(creep) {
        var assignment = Game.flags[creep.memory.assignment];
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            creep.task = null;
            var target = this.findTarget(creep);
            if (target) {
                let task = tasks('heal');
                creep.assign(task, target);
            }
        }
        if (creep.task) {
            return creep.task.step();
        }
        if (assignment) {
            if (creep.pos.inRangeTo(assignment.pos, 5) && creep.memory.data.replaceAt == 0) {
                creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 25;
            }
            if (!creep.task) {
                creep.moveToVisual(assignment.pos, 'green');
            }
        }
    }
}

module.exports = roleHealer;