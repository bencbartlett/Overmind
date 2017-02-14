// var upgrader = require('role_upgrader');

var roleGuard = { // TODO: refactor into hauler
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        creepSizeLimit = 5;
        var body = [];
        for (let i = 0; i < creepSizeLimit; i++) {
            body.push(ATTACK);
            body.push(MOVE);
        }
        return spawn.createCreep(body, spawn.creepName('guard'), {role: 'guard'});
    },

    getAssignment: function (creep) {
        var untargetedFlags = _.filter(Game.flags, (f) => f.color == COLOR_BLUE &&
                                                          f.isTargeted('guard').length < 1); // TODO: this assignment pattern can be prototyped
        if (untargetedFlags.length > 0) {
            // var controller = untargetedFlags[0].room.controller;
            creep.memory.assignment = untargetedFlags[0].name;
            console.log(creep.name + " assigned to: " + untargetedFlags[0].name);
        } else {
            console.log(creep.name + " could not receive an assignment.");
        }
    },

    guardMode: function(creep) {
        // Attack nearest enemy creep
        if (creep.goAttack() != OK) {
            var assignedFlag = Game.flags[creep.memory.assignment];
            creep.moveToVisual(assignedFlag, 'red'); // return to flag if nothing to attack
        }
    },

    run: function (creep) {
        // Get an assignment if you don't have one already
        if (!creep.memory.assignment) {
            this.getAssignment(creep);
        }
        // var assignedFlag = Game.flags[creep.memory.assignment]; // This is a flag, not an ID!
        // if (!creep.isInRoom(assignedFlag.pos.roomName)) { // move to the room the flag is in
        //     creep.moveToVisual(assignedFlag.pos, 'red');
        // } else {
        //     if (creep.memory.working) {
        //         this.mineMode(creep);
        //     } else {
        //         this.depositBuildMode(creep);
        //     }
        // }
        this.guardMode(creep);
    }
};

module.exports = roleGuard;