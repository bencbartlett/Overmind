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

Object.defineProperty(StructureSpawn.prototype, 'uptime', {
    get () {
        if (Memory.stats && Memory.stats.spawnUsage && Memory.stats.spawnUsage[this.name]) {
            let workingTicks = _.filter(Memory.stats.spawnUsage[this.name], entry => entry != "0").length;
            return workingTicks / Memory.stats.spawnUsage[this.name].length
        } else {
            console.log(this.name + ": error accessing spawn usage in Memory!");
            return null;
        }
    }
});

Object.defineProperty(StructureSpawn.prototype, 'statusMessage', {
    get () {
        if (this.spawning) {
            let spawning = this.spawning;
            let percent = Math.round(100 * (spawning.needTime - spawning.remainingTime) / spawning.needTime);
            let message = spawning.name + ": " + Game.creeps[spawning.name].assignment.pos.roomName +
                          " (" + percent + "%)";
            return message;
        } else {
            if (this.room.energyAvailable < this.room.energyCapacityAvailable) {
                return 'reloading';
            } else {
                return 'idle'
            }
        }
    }
});

StructureSpawn.prototype.pathLengthTo = function (roomObj) {
    if (!this.memory.pathLengths) {
        this.memory.pathLengths = {}
    }
    if (!this.memory.pathLengths[roomObj.ref]) {
        this.memory.pathLengths[roomObj.ref] = require('pathing').findPathLengthIncludingRoads(roomObj.pos, this.pos);
    }
    return this.memory.pathLengths[roomObj.ref];
};