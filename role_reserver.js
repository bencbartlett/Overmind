// Reserver: reserves rooms targeted with a purple flag

var roleReserver = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createCreep([CLAIM, CLAIM, MOVE, MOVE], spawn.creepName('reserver'), {role: 'reserver'});
    },

    getAssignment: function (creep) {
        var untargetedFlags = _.filter(Game.flags, (f) => f.color == COLOR_PURPLE &&
                                                          f.isTargeted('reserver').length == 0);
        if (untargetedFlags.length > 0) {
            // new memory object: assignment. Assignment is like target but is never changed
            creep.memory.assignment = untargetedFlags[0].name;
            console.log(creep.name + " assigned to: " + untargetedFlags[0].name);
        } else {
            console.log(creep.name + " could not receive an assignment.");
        }
    },

    run: function (creep) {
        // Get an assignment if you don't have one already
        if (!creep.memory.assignment) {
            this.getAssignment(creep);
        }
        var assignedFlag = Game.flags[creep.memory.assignment]; // This is a flag, not an ID!
        if (!creep.isInRoom(assignedFlag.pos.roomName)) {
            creep.moveToVisual(assignedFlag.pos, 'purple');
        } else {
            if (creep.reserveController(assignedFlag.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveToVisual(assignedFlag.room.controller, 'purple');
            }
        }
    }
};

module.exports = roleReserver;