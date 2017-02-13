global.highlightAllCreeps = function (role, color = 'green') {
    var creeps = _.filter(Game.creeps, (creep) => creep.memory.role == role);
    for (let i in creeps) {
        creeps[i].room.visual.circle(creeps[i].pos, {fill: 'transparent', radius: 0.55, stroke: color});
    }
};

global.countAllCreeps = function (role) {
    return _.filter(Game.creeps, (creep) => creep.memory.role == role).length;
};

global.modeToWorking = function () {
    // One-time use function to migrate creep.memory.mode string to creep.memory.working mutex
    var nonMinerHarvesterCreeps = _.filter(Game.creeps,
                                           (creep) => !(creep.memory.role == 'miner' || creep.memory.role == 'harvester'));
    var minerHarvesterCreeps = _.filter(Game.creeps,
                                        (creep) => (creep.memory.role == 'miner' || creep.memory.role == 'harvester'));
    for (let i in nonMinerHarvesterCreeps) {
        let creep = nonMinerHarvesterCreeps[i];
        creep.working = !(creep.memory.mode == 'harvest' || creep.memory.mode == 'withdraw');
        delete creep.memory.mode;
    }
    for (let i in minerHarvesterCreeps) {
        let creep = minerHarvesterCreeps[i];
        creep.working = (creep.memory.mode == 'harvest' || creep.memory.mode == 'withdraw');
        delete creep.memory.mode;
    }
};

global.status = function () {
    console.log("Creep status: ");
    var roles = require('rolesMap');
    for (let role in roles) {
        console.log(role + ": " + countAllCreeps(role));
    }
    return '';
};