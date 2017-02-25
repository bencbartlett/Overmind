// Global RoomVisuals drawn in every room

var visuals = {
    drawSpawnInfo: function (room) {
        for (let spawn of room.spawns) {
            let spawning = spawn.spawning;
            if (spawning) {
                let percent = Math.round(100 * (spawning.needTime - spawning.remainingTime) / spawning.needTime);
                new RoomVisual(room.name).text(
                    "🛠 " + spawning.name + " (" + percent + "%)",
                    spawn.pos.x + 1, spawn.pos.y, {align: 'left'})
            }
        }
    },

    drawStorageInfo: function (room) {
        if (room.storage) {
            new RoomVisual(room.name).text(
                Math.floor(room.storage.store[RESOURCE_ENERGY] / 1000) + "K", room.storage.pos);
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