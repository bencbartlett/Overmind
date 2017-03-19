// Spawner brain: handles a semi-global spawn queue for handling remote operations

class SpawnBrain {
    constructor(spawnName) {
        this.name = spawnName;
        this.spawn = Game.spawns[spawnName];
        this.room = this.spawn.room;
        if (!Memory.globalSpawnQueue) {
            Memory.globalSpawnQueue = {};
        }
        this.localSpawnQueue = this.room.localSpawnQueue;
        this.globalSpawnQueue = Memory.globalSpawnQueue;
        // Settings shared across all rooms
        this.settings = {

        };
        this.localSpawnPriorities = [
            'supplier',
            'linker',
            'miner',
            'hauler',
            'worker',
            'upgrader'
        ];
        this.globalSpawnPriorities = [
            'scout',
            'guard',
            'miner',
            ''
        ]
    }

    get memory() {
        if (!Memory.spawnBrain[this.name]) {
            Memory.spawnBrain[this.name] = {};
        }
        return Memory.spawnBrain[this.name];
    }

    run() {
        if (this.spawn.spawning) {
            return null;
        }
        if (this.localSpawnQueue) {

        }
    }
}

profiler.registerClass(SpawnBrain, 'SpawnBrain');

module.exports = SpawnBrain;