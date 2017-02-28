// Global RoomVisuals drawn in every room

// TODO: this stopped working.. why?

var visuals = {
    drawSpawnInfo: function (room) {
        for (let spawn of room.spawns) {
            let spawning = spawn.spawning;
            if (spawning) {
                let percent = Math.round(100 * (spawning.needTime - spawning.remainingTime) / spawning.needTime);
                let message =  "🛠 " + spawning.name + " (" + percent + "%)";
                new RoomVisual(room.name).text(message, spawn.pos.x + 1, spawn.pos.y, {font: '0.7', align: 'left'});
            }
        }
    },

    drawStorageInfo: function (room) {
        if (room.storage) {
            new RoomVisual(room.name).text(
                Math.floor(room.storage.store[RESOURCE_ENERGY] / 1000) + "K", room.storage.pos, {font: '0.7'});
        }
    },

    // drawCreepInfo: function (room) {
    //     for (let creep of room.creepsInRoom) {
    //         new RoomVisual(room.name).text('🛠', creep.pos);
    //     }
    // },

    drawAll: function (room) {
        this.drawSpawnInfo(room);
        this.drawStorageInfo(room);
        // this.drawCreepInfo(room);
    }
};

module.exports = visuals;