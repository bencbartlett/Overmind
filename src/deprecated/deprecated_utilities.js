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

global.convertOldCreepsToWorkers = function () {
    // One-time use function to migrate repairers, builders, upgraders to worker class
    var creepsToConvert = _.filter(Game.creeps,
                                   creep => creep.memory.role == 'repairer' ||
                                            creep.memory.role == 'builder' ||
                                            creep.memory.role == 'upgrader');
    for (let i in creepsToConvert) {
        var creep = creepsToConvert[i];
        creep.memory.role = 'worker';
        creep.memory.working = false;
        creep.memory.task = null;
        creep.memory.data = {origin: creep.room.name, serviceRoom: creep.room.name};
    }
    return OK;
};

global.fixMinerMemory = function () {
    // One-time use function to migrate repairers, builders, upgraders to worker class
    var creepsToConvert = _.filter(Game.creeps,
                                   creep => creep.memory.role == 'miner');
    for (let i in creepsToConvert) {
        var creep = creepsToConvert[i];
        creep.memory.data = {origin: creep.room.name, serviceRoom: creep.room.name, replaceNow: false};
    }
    return OK;
};

global.clearLog = function () {
    let clr = "<script>angular.element(document.getElementsByClassName('fa fa-trash ng-scope')" +
              "[0].parentNode).scope().Console.clear()</script>";
    console.log(clr);
};

global.clearAllCachedFlagPathLengths = function () { // clear all cached path length associated with flags
    for (let name in Game.flags) {
        let flag = Game.flags[name];
        if (flag.memory.pathLengthToAssignedRoomStorage) {
            console.log("Cleared cached path length for flag " + name);
            delete flag.memory.pathLengthToAssignedRoomStorage;
        }
        if (flag.memory.pathLengthToStorage) {
            console.log("Cleared cached path length for flag " + name);
            delete flag.memory.pathLengthToStorage;
        }
    }
};

global.clearRoomCaches = function () {
    for (let i in Game.rooms) {
        Game.rooms[i].memory.cache = {};
        Game.rooms[i].memory.cacheHistory = {};
        console.log('Cleared cache for room ' + Game.rooms[i].name);
    }
    return OK;
};