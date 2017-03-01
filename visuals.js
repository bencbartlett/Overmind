// Global RoomVisuals drawn in every room

var visuals = {
    drawSpawnInfo: function (room) {
        for (let spawn of room.spawns) {
            let spawning = spawn.spawning;
            if (spawning) {
                let percent = Math.round(100 * (spawning.needTime - spawning.remainingTime) / spawning.needTime);
                let message = "🛠 " + spawning.name + " (" + percent + "%)";
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

    drawLogo: function () {
        var asciiLogo = ['___________________________________________________________',
                         '',
                         ' _____  _    _ _______  ______ _______ _____ __   _ ______',
                         '|     |  \\  /  |______ |_____/ |  |  |   |   | \\  | |     \\',
                         '|_____|   \\/   |______ |    \\_ |  |  | __|__ |  \\_| |_____/',
                         '',
                         '___________________________________________________________'];
        var row = 0;
        var column = 39.5;
        var fontSize = 0.25;
        for (line of asciiLogo) {
            new RoomVisual().text(line, column, row, {font: fontSize + ' Courier', align: 'left'});
            row += fontSize;
        }
    },

    drawRoomVisuals: function (room) {
        this.drawSpawnInfo(room);
        this.drawStorageInfo(room);
        // this.drawCreepInfo(room);
    },

    drawGlobalVisuals: function () {
        this.drawLogo();
    }
};

module.exports = visuals;