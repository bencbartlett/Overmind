// Data logging procedures; collects relevant data at every tick and stores them in memory
// Eventually will move over to asynchronous memory segments when memory requirements are too large

class dataLogger {
    constructor() {
        this.settings = {
            rollingSpawnUsageLength: 3000, // keep in memory for this many ticks
        }
    }

    get memory() {
        return Memory.stats;
    }

    verify(memoryType) {
        if (!Memory.stats) {
            Memory.stats = {};
        }
        if (!Memory.stats[memoryType]) {
            Memory.stats[memoryType] = {};
        }
    }

    logSpawnUsage() {
        this.verify('spawnUsage');
        for (let spawnName in Game.spawns) {
            let spawn = Game.spawns[spawnName];
            if (!Memory.stats.spawnUsage[spawnName]) { //
                Memory.stats.spawnUsage[spawnName] = [];
            }
            //let logger = Memory.stats.spawnUsage[spawnName];
            //console.log(logger);
            if (spawn.spawning) {
                Memory.stats.spawnUsage[spawnName].push(spawn.spawning.name);
            } else {
                Memory.stats.spawnUsage[spawnName].push('0');
            }
            while (Memory.stats.spawnUsage[spawnName].length > this.settings.rollingSpawnUsageLength) {
                Memory.stats.spawnUsage[spawnName].shift(); // discard the oldest value
            }
        }
    }

    run() {
        this.logSpawnUsage(); // log all spawn usage
    }
}

// const profiler = require('screeps-profiler');
profiler.registerClass(dataLogger, 'dataLogger');

module.exports = dataLogger;