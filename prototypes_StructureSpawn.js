// var rolesMap = require('map_roles');

StructureSpawn.prototype.creepName = function (roleName) {
    // generate a creep name based on the role and add a suffix to make it unique
    var i = 0;
    while (Game.creeps[(roleName + '_' + i)] != undefined) {
        i++;
    }
    return (roleName + '_' + i);
};

StructureSpawn.prototype.cost = function (bodyArray) {
    var partCosts = {
        'move': 50,
        'work': 100,
        'carry': 50,
        'attack': 80,
        'ranged_attack': 150,
        'heal': 250,
        'claim': 600,
        'tough': 10
    };
    var cost = 0;
    for (let part of bodyArray) {
        cost += partCosts[part];
    }
    return cost;
};

Object.defineProperty(StructureSpawn.prototype, 'spawnQueue', {
    get () {
        if (!this.memory.spawnQueue) {
            this.memory.spawnQueue = {};
        }
        return this.memory.spawnQueue;
    }
});

