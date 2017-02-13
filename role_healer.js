// var upgrader = require('role_upgrader');

var roleHealer = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        return spawn.createCreep([HEAL, MOVE], spawn.creepName('meleeAttacker'), {role: 'healer'});
    },

    run: function (creep) {
        // Attack nearest enemy creep
        if (creep.goHeal() != OK) {
            creep.moveTo(creep.room.controller); // return to controller if nothing to attack
        }
    }
};

module.exports = roleHealer;