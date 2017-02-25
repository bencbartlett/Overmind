// Scout - grants vision in reserved rooms

var roleScout = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    settings: {
        bodyPattern: [MOVE]
    },

    create: function (spawn, assignment) {
        return spawn.createCreep(this.settings.bodyPattern, spawn.creepName('scout'), {
            role: 'scout', assignment: assignment, data: {
                origin: spawn.room.name, replaceAt: 0
            }
        });
    },

    run: function (creep) {
        var target = Game.flags[creep.memory.assignment].pos;
        if (!creep.pos.inRangeTo(target, 1)) {
            creep.moveToVisual(target);
        } else if (creep.memory.data.replaceAt == 0) {
            creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 50;
        }
    }
};

module.exports = roleScout;