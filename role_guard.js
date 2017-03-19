// Guard: dumb bot that goes to a flag and then attacks everything hostile in the room, returning to flag
// Best used only against low level npc invaders; sized to defend outposts

var tasks = require('tasks');
var Role = require('Role');

class roleGuard extends Role {
    constructor() {
        super('guard');
        // Role-specific settings
        this.settings.bodyPattern = [MOVE, ATTACK, RANGED_ATTACK];
        this.settings.orderedBodyPattern = true;
        this.settings.notifyOnNoTask = false;
        this.roleRequirements = creep => creep.getActiveBodyparts(ATTACK) > 1 &&
                                         creep.getActiveBodyparts(RANGED_ATTACK) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }

    create(spawn, {assignment, workRoom, patternRepetitionLimit = Infinity}) {
        if (!workRoom) {
            workRoom = assignment.roomName;
        }
        if (assignment.room && assignment.room.brain.getTasks('repair').length > 0) { // create a guard to repair stuff
            this.settings.bodySuffix = [WORK, CARRY, MOVE];
            this.settings.proportionalPrefixSuffix = false; // just want one repetition
        }
        let creep = this.generateLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: patternRepetitionLimit
        });
        return creep; // spawn.createCreep(creep.body, creep.name, creep.memory)
    }

    recharge(creep) {
        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0)
        });
        if (target) {
            return creep.assign(tasks('recharge'), target);
        }
    }

    findTarget(creep) {
        var target;
        var targetPriority = [
            () => creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {filter: c => c.getActiveBodyparts(HEAL) > 0}),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits})
        ];
        for (let targetThis of targetPriority) {
            target = targetThis();
            if (target) {
                return target;
            }
        }
        return null;
    }

    newTask(creep) {
        creep.task = null;
        // if not in the assigned room, move there; executed in bottom of run function
        if (creep.assignment && !creep.inSameRoomAs(creep.assignment)) {
            return null;
        }
        // first try to find anything you should attack
        var target = this.findTarget(creep);
        if (target) {
            let task = tasks('attack');
            return creep.assign(task, target);
        }
        // if no hostiles and you can repair stuff, do so
        if (creep.getActiveBodyparts(CARRY) > 0 && creep.getActiveBodyparts(WORK) > 0) {
            if (creep.carry.energy == 0) {
                return this.recharge(creep);
            } else {
                return this.requestTask(creep); // get applicable tasks from room brain
            }
        }
    }

    run(creep) {
        var assignment = creep.assignment;
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget()) ||
            (creep.room.hostiles.length > 0 && creep.task && creep.task.name != 'attack')) {
            this.newTask(creep);
        }
        if (creep.task) {
            return creep.task.step();
        }
        if (assignment) {
            if (creep.pos.inRangeTo(assignment.pos, 5) && creep.memory.data.replaceAt == 0) {
                creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 25;
            }
            if (!creep.task) {
                // creep.moveToVisual(assignment.pos, 'red');
                creep.travelTo(assignment.pos);
            }
        }
    }
}

module.exports = roleGuard;