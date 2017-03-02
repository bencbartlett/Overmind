var flagCodes = require('map_flag_codes');

Flag.prototype.assign = function (roomName) {
    this.memory.assignedRoom = roomName;
    console.log(this.name + " now assigned to room " + this.memory.assignedRoom + ".");
    return OK;
};

Object.defineProperty(Flag.prototype, 'category', { // the category object in flagCodes map
    get () {
        return _.find(flagCodes, cat => cat.color == this.color);
    }
});

Object.defineProperty(Flag.prototype, 'type', { // subcategory object
    get () {
        return _.find(this.category, type => type.secondaryColor == this.secondaryColor);
    }
});

Object.defineProperty(Flag.prototype, 'assignedRoom', { // the room the flag is assigned to
    get () {
        if (!this.memory.assignedRoom) {
            return null;
        } else {
            return Game.rooms[this.memory.assignedRoom];
        }
    }
});

Object.defineProperty(Flag.prototype, 'pathLengthToAssignedRoomStorage', {
    get () {
        if (!this.memory.pathLengthToAssignedRoomStorage) {
            this.memory.pathLengthToAssignedRoomStorage =
                require('pathing').findPathLengthIncludingRoads(this.assignedRoom.storage.pos, this.pos)
        }
        return this.memory.pathLengthToAssignedRoomStorage;
    }
});

Flag.prototype.action = function (...args) {
    return this.type.action(this, ...args); // calls flag action with this as flag argument
};