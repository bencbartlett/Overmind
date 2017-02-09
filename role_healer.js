// var upgrader = require('role_upgrader');

var roleHealer = {
    /** @param {Creep} creep **/
    run: function (creep) {
        // Attack nearest enemy creep
        if (creep.goHeal() != OK) {
            creep.moveTo(creep.room.controller); // return to controller if nothing to attack
        }
    }
};

module.exports = roleHealer;