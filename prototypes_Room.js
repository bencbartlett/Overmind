Room.prototype.totalSourceCapacity = function () {
    if (this.memory.miningCapacity != undefined) {
        return this.memory.miningCapacity;
    } else {
        var capacity = 0;
        var sources = this.find(FIND_SOURCES);
        for (i in sources) {
            capacity += sources[i].capacity();
        }
        this.memory.miningCapacity = capacity;
        return capacity;
    }
};