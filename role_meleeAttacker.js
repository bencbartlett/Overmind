var roleMeleeAttacker = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/
    /** @param {Number} creepSizeLimit **/

    create: function (spawn, creepSizeLimit = Infinity) {
        creepSizeLimit = 5;
        var body = [];
        for (let i = 0; i < creepSizeLimit; i++) { // add parts
            body.push(ATTACK);
            body.push(MOVE);
        }
        return spawn.createCreep(body, spawn.creepName('meleeAttacker'), {role: 'meleeAttacker'});
    },

    run: function (creep) {
        // Attack nearest enemy creep
        if (creep.goAttack() != OK) {
            creep.moveTo(creep.room.controller); // return to controller if no creep to attack
        }
    }
};

module.exports = roleMeleeAttacker;