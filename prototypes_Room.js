//noinspection JSUnusedGlobalSymbols
Room.prototype.totalSourceCapacity = function () {
    if (this.memory.miningCapacity != undefined) {
        return this.memory.miningCapacity;
    } else {
        var capacity = 0;
        var sources = this.find(FIND_SOURCES);
        for (let i in sources) {
            capacity += sources[i].capacity();
        }
        this.memory.miningCapacity = capacity;
        return capacity;
    }
};

Room.prototype.remainingMinerSourceAssignments = function () {
    var sources = this.find(FIND_SOURCES);
    var miners = this.find(FIND_MY_CREEPS, {filter: (c) => c.memory.role == 'miner'});
    var assignments = {};
    for (let i in sources) {
        // assignment becomes a dictionary with source ID keys and number of remaining spots as values
        let numAssigned = _.filter(miners, (c) => c.memory.assignment == sources[i].id).length;
        let maxSpots = Math.min(sources[i].capacity(), 2);
        assignments[sources[i].id] = maxSpots - numAssigned;
    }
    return assignments;
};

//noinspection JSUnusedGlobalSymbols
Room.prototype.convertAllCreeps = function (convertFrom, convertTo) {
    var creepsToConvert = this.find(FIND_MY_CREEPS, {filter: (c) => c.memory.role == convertFrom});
    for (let i in creepsToConvert) {
        let creep = creepsToConvert[i];
        // Change role
        creep.memory.role = convertTo;
        // Clear mode
        creep.memory.mode = undefined;
        // Clear target
        creep.memory.target = undefined;
    }
};