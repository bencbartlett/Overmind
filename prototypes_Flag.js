Flag.prototype.assign = function (roomName) {
    this.memory.room = roomName;
};

Object.defineProperty(Flag.prototype, 'pathLengthToAssignedRoomStorage', {
    get () {
        if (!this.memory.pathLengthToAssignedRoomStorage) {
            this.memory.pathLengthToAssignedRoomStorage = PathFinder.search(
                Game.rooms[this.memory.room].storage.pos, this.pos
            ).path.length
        }
        return this.memory.pathLengthToAssignedRoomStorage;
    }
});