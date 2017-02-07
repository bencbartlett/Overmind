'use strict';

// Import prototype modules (each has own internal imports)
require('prototypes_creep');
require('prototypes_spawn');

// Main loop
module.exports.loop = function () {
    // var tower = Game.getObjectById('a02d0da0edb10a85cb511e8e');
    // if (tower) {
    //     var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
    //         filter: (structure) => structure.hits < structure.hitsMax
    //     });
    //     if (closestDamagedStructure) {
    //         tower.repair(closestDamagedStructure);
    //     }
    //
    //     var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    //     if (closestHostile) {
    //         tower.attack(closestHostile);
    //     }
    // }

    // Clear memory for non-existent creeps
    for (let name in Memory.creeps) {
        if (Game.creeps[name] == undefined) {
            delete Memory.creeps[name];
        }
    }

    // Animate each creep
    for (let name in Game.creeps) {
        Game.creeps[name].doRole();
    }

    // Animate each spawn
    for (let name in Game.spawns) {
        Game.spawns[name].work();
    }
};