// Room visuals collection
var flagCodes = require('map_flag_codes');

var visuals = {
    drawSpawnInfo: function (room) {
        for (let spawn of room.spawns) {
            if (spawn.spawning) {
                new RoomVisual(room.name).text("🛠 " + spawn.statusMessage,
                                               spawn.pos.x + 1, spawn.pos.y, {font: '0.7', align: 'left'});
            }
        }
    },

    drawStorageInfo: function (room) {
        if (room.storage) {
            new RoomVisual(room.name).text(
                Math.floor(room.storage.store[RESOURCE_ENERGY] / 1000) + "K", room.storage.pos, {font: '0.7'});
        }
    },

    drawHUD: function () {
        var fontSize, font, style;
        fontScale = 1.3;
        // Draw the logo
        fontSize = 0.25 * fontScale;
        font = fontSize + ' Courier';
        style = {font: font, align: 'left'};
        var asciiLogo = ['___________________________________________________________',
                         '',
                         ' _____  _    _ _______  ______ _______ _____ __   _ ______ ',
                         '|     |  \\  /  |______ |_____/ |  |  |   |   | \\  | |     \\',
                         '|_____|   \\/   |______ |    \\_ |  |  | __|__ |  \\_| |_____/',
                         '',
                         '___________________________________________________________'];
        var width = asciiLogo[0].length;
        var row = 0;
        var column = 0;
        for (line of asciiLogo) {
            new RoomVisual().text(line, column, row, style);
            row += 0.8 * fontSize;
        }
        row += 2 * fontSize;
        if (Game.cpu.bucket < 9000) {
            new RoomVisual().text("Insufficient CPU bucket to calculate stats.", column, row, style);
        }
        // Display room information for owned rooms
        fontSize = 0.45 * fontScale;
        font = fontSize + ' Courier';
        style = {font: font, align: 'left'};
        new RoomVisual().text('Owned rooms:', column, row, style);
        row += fontSize;
        var ownedRooms = _.filter(Game.rooms, room => room.controller.my);
        for (let i in ownedRooms) {
            let room = ownedRooms[i];
            let progressPercent = Math.round(100 * room.controller.progress / room.controller.progressTotal) + "%";
            let info = "Pr: " + progressPercent + " ";
            if (room.storage) {
                info += "En: " + Math.floor(room.storage.store[RESOURCE_ENERGY] / 1000) + "K "
            }
            new RoomVisual().text("  ⬛ " + room.name + ": " + info, column, row, style);
            row += fontSize;
            if (room.spawns.length > 0) {
                for (let spawn of room.spawns) {
                    if (spawn.spawning) {
                        new RoomVisual().text("    🛠 " + spawn.name + ": " + spawn.statusMessage, column, row, style);
                    } else {
                        new RoomVisual().text("    ⬜ " + spawn.name + ": " + spawn.statusMessage, column, row, style);
                    }
                    row += fontSize;
                }
            }

        }
        // Display room information for occupied rooms
        new RoomVisual().text('Occupied rooms:', column, row, style);
        row += fontSize;
        var reserveFlags = _.filter(Game.flags, flagCodes.territory.reserve.filter);
        for (let flag of reserveFlags) {
            var icon = "⬜";
            if (!flag.room) {
                icon = "👁";
            } else if (!(flag.room.controller.reservation && flag.room.controller.reservation.username == "Muon")) {
                icon = "✖";
            } else if (flag.room.hostiles.length > 0) {
                icon = "⚔";
            }
            let info = "no vision!";
            if (flag.room) { // TODO: this is pretty quick and dirty; maybe improve later
                var totalMiners = 0;
                var totalHaulers = 0;
                var totalGuards = 0;
                var totalReservers = 0;
                var totalWorkers = 0;
                for (flag of flag.room.flags) {
                    totalReservers += _.filter(flag.assignedCreeps,
                                               creep => creep.memory.role == 'reserver' &&
                                                        creep.ticksToLive > creep.memory.data.replaceAt).length;
                    totalGuards += _.filter(flag.assignedCreeps,
                                            creep => creep.memory.role == 'guard' &&
                                                     creep.ticksToLive > creep.memory.data.replaceAt).length;
                    totalMiners += _.filter(flag.assignedCreeps,
                                            creep => creep.memory.role == 'miner' &&
                                                     creep.ticksToLive > creep.memory.data.replaceAt).length;
                    totalHaulers += _.filter(flag.assignedCreeps, creep => creep.memory.role == 'hauler').length;
                    totalWorkers += _.filter(Game.creeps, creep => creep.memory.role == 'worker' &&
                                                                   creep.assignment == flag).length;
                }
                info = totalGuards + "G " +
                       totalReservers + "R " +
                       totalMiners + "M " +
                       totalHaulers + "H " +
                       totalWorkers + "W";
            }
            new RoomVisual().text("  " + icon + " " + flag.roomName + ": " + info, column, row, style);
            row += fontSize;
        }
    },

    drawRoomVisuals: function (room) {
        this.drawSpawnInfo(room);
        this.drawStorageInfo(room);
        // this.drawCreepInfo(room);
    },

    drawGlobalVisuals: function () {
        this.drawHUD();
    }
};

module.exports = visuals;