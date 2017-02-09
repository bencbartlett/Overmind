global.highlightAllCreeps = function (role) {
    var creeps = _.filter(Game.creeps, (creep) => creep.role() == role);
    for (let i in creeps) {
        creeps[i].room.visual.circle(creeps[i].pos, {fill: 'transparent', radius: 0.55, stroke: 'green'});
    }
};

global.countAllCreeps = function (role) {
    return _.filter(Game.creeps, (creep) => creep.role() == role).length;
};

global.modeToWorking = function () {
    // One-time use function to migrate creep.memory.mode string to creep.memory.working mutex
    var nonMinerHarvesterCreeps = _.filter(Game.creeps,
                                           (creep) => !(creep.role() == 'miner' || creep.role() == 'harvester'));
    var minerHarvesterCreeps = _.filter(Game.creeps,
                                        (creep) => (creep.role() == 'miner' || creep.role() == 'harvester'));
    for (let i in nonMinerHarvesterCreeps) {
        let creep = nonMinerHarvesterCreeps[i];
        if (creep.memory.mode == 'harvest' || creep.memory.mode == 'withdraw') {
            creep.working = false;
        } else {
            creep.working = true;
        }
        delete creep.memory.mode;
    }
    for (let i in minerHarvesterCreeps) {
        let creep = minerHarvesterCreeps[i];
        if (creep.memory.mode == 'harvest' || creep.memory.mode == 'mine') {
            creep.working = true;
        } else {
            creep.working = true;
        }
        delete creep.memory.mode;
    }
}