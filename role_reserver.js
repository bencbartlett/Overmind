// Reserver: reserves rooms targeted with a purple flag

var roleReserver = {
    /** @param {Creep} creep **/
    getAssignment: function (creep) {
        var untargetedFlags = _.filter(Game.flags, (f) => f.color == COLOR_PURPLE);// && f.isTargeted('reserver') == false);
        if (untargetedFlags.length > 0) {
            // var controller = untargetedFlags[0].room.controller;
            creep.memory.target = untargetedFlags[0].name;
            console.log(creep.name + " assigned to: " + untargetedFlags[0].name);
        } else {
            console.log(creep.name + " could not receive an assignment.");
        }
    },

    run: function (creep) {
        // Get an assignment if you don't have one already
        if (!creep.memory.target) {
            this.getAssignment(creep);
        }
        var targetFlag = Game.flags[creep.memory.target]; // This is a position, not an ID!
        if (!creep.isInRoom(targetFlag.pos.roomName)) {
            creep.moveToVisual(targetFlag.pos, 'purple');
        } else {
            if (creep.reserveController(targetFlag.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveToVisual(targetFlag.room.controller, 'purple');
            }
        }
    }
};

module.exports = roleReserver;