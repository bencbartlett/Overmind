// Scout - grants vision in reserved rooms
var tasks = require('tasks');
var Role = require('Role');

class roleScout extends Role {
    constructor() {
        super('scout');
        // Role-specific settings
        this.settings.bodyPattern = [MOVE];
        this.roleRequirements = creep => creep.getActiveBodyparts(MOVE) > 1
    }

    create(spawn, {
        assignment = 'needs flagged assignment',
        workRoom = assignment.roomName,
        patternRepetitionLimit = 1
    }) {
        return this.createLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: patternRepetitionLimit
        });
    }

    run(creep) {
        if (creep.assignment) {
            var target = creep.assignment.pos;
            if (!creep.pos.inRangeTo(target, 1)) {
                creep.moveToVisual(target);
            } else if (creep.memory.data.replaceAt == 0) {
                creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 50;
            }
        }
    }

}


// var roleScout = {
//     /** @param {Creep} creep **/
//     /** @param {StructureSpawn} spawn **/
//     /** @param {Number} creepSizeLimit **/
//
//     settings: {
//         bodyPattern: [MOVE]
//     },
//
//     create: function (spawn, assignment) {
//         return spawn.createCreep(this.settings.bodyPattern, spawn.creepName('scout'), {
//             role: 'scout', assignment: assignment, data: {
//                 origin: spawn.room.name, replaceAt: 0
//             }
//         });
//     },
//
//     run: function (creep) {
//         if (creep.assignment) {
//             var target = creep.assignment.pos;
//             if (!creep.pos.inRangeTo(target, 1)) {
//                 creep.moveToVisual(target);
//             } else if (creep.memory.data.replaceAt == 0) {
//                 creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 50;
//             }
//         }
//     }
// };

module.exports = roleScout;