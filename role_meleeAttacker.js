// var upgrader = require('role_upgrader');

var roleMeleeAttacker = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createCreep([ATTACK, MOVE], spawn.creepName('meleeAttacker'), {role: 'meleeAttacker'});
    },

    run: function (creep) {
        // Attack nearest enemy creep
        if (creep.goAttack() != OK) {
            creep.moveTo(creep.room.controller); // return to controller if nothing to attack
        }
    }
};

module.exports = roleMeleeAttacker;