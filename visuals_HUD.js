var flagCodes = require('map_flag_codes');

var fontSize;
var style = {color: '#ffffff', align: 'left', opacity: 0.5};
var fontScale = 1.3;
var row = 0;
var column = 0;

var HUD = {
    verifyMemory: function () {
        if (!Memory.visuals) {
            Memory.visuals = {};
        }
        if (!Memory.visuals.HUD) {
            Memory.visuals.HUD = {};
        }
        if (!Memory.visuals.HUD.ownedRoomInfo) {
            this.getOwnedRoomInfo();
        }
        if (!Memory.visuals.HUD.occupiedRoomInfo) {
            this.getOccupiedRoomInfo();
        }
        if (!Memory.visuals.HUD.lastCalculated) {
            Memory.visuals.HUD.lastCalculated = Game.time;
        }
    },

    drawLogo: function () {
        // Draw the logo
        fontSize = 0.3 * fontScale;
        style.font = fontSize + " Courier";
        var asciiLogo = ['___________________________________________________________',
                         '',
                         ' _____  _    _ _______  ______ _______ _____ __   _ ______ ',
                         '|     |  \\  /  |______ |_____/ |  |  |   |   | \\  | |     \\',
                         '|_____|   \\/   |______ |    \\_ |  |  | __|__ |  \\_| |_____/',
                         '',
                         '___________________________________________________________'];
        row = 0;
        style.color = '#ffffff';
        row = new RoomVisual().multitext(asciiLogo, column, row, fontSize, style);
        row += 2 * fontSize;
    },

    drawCpuInfo: function () {
        fontSize = 0.5 * fontScale;
        style.font = fontSize + " Courier";
        // Display CPU Information
        new RoomVisual().text("CPU:" + " bucket:" + Game.cpu.bucket +
                              " tickLimit:" + Game.cpu.tickLimit, column, row, style);
        row += fontSize;
    },

    getOwnedRoomInfo: function () {
        // Display room information for owned rooms
        let text = [];
        text.push("Owned rooms:");
        var ownedRooms = _.sortBy(_.filter(Game.rooms, room => room.controller && room.controller.my),
                                  function (room) {
                                      if (room.controller.level < 8) {
                                          return -1 * (room.controller.level +
                                                       room.controller.progress / room.controller.progressTotal);

                                      } else {
                                          return -1 * Infinity;
                                      }
                                  });
        for (let i in ownedRooms) {
            let room = ownedRooms[i];
            let progressPercent;
            if (room.controller.level < 8) {
                progressPercent = Math.round(100 * room.controller.progress / room.controller.progressTotal) + "%";
            } else {
                progressPercent = "100%";
            }
            let info = "";
            if (room.brain.incubating) {
                info += "(incubating) ";
            }
            info += progressPercent + ", ";
            if (room.storage) {
                info += Math.floor(room.storage.store[RESOURCE_ENERGY] / 1000) + "K, ";
                let numHaulers = room.storage.getAssignedCreepAmounts('hauler');
                let haulerCargoSize = Math.min((room.energyCapacityAvailable - 150) * 2 / 3, (50 - 2) * 2 / 3 * 50);
                let neededHaulers = Math.ceil(room.brain.calculateRemoteHaulingRequirements() / haulerCargoSize);
                info += numHaulers + "/" + neededHaulers + "H";
            }
            text.push("  ⬜ " + room.name + ": " + info);
            if (room.spawns.length > 0) {
                for (let spawn of room.spawns) {
                    if (spawn.spawning) {
                        text.push("    🛠 " + spawn.name + ": " + spawn.statusMessage);
                    } else {
                        text.push("    ⬜ " + spawn.name + ": " + spawn.statusMessage);
                    }
                }
            }
        }
        Memory.visuals.HUD.ownedRoomInfo = text;
        Memory.visuals.HUD.lastCalculated = Game.time;
    },

    getOccupiedRoomInfo: function () {
        // Display room information for occupied rooms
        let text = [];
        text.push('Occupied rooms:');
        var reserveFlags = _.filter(Game.flags, flagCodes.territory.reserve.filter);
        for (let flag of reserveFlags) {
            var icon = "🏳";
            if (!flag.room) {
                icon = "👁";
            } else if (!flag.room.reservedByMe) {
                icon = "✖";
            } else if (flag.room.hostiles.length > 0) {
                icon = "⚔";
            }
            let info = "no vision!";
            if (flag.room) { // TODO: this is pretty quick and dirty; maybe improve later
                var totalMiners = 0, requiredMiners = 0;
                // var totalHaulers = 0, requiredHaulers = 0;
                var totalGuards = 0, requiredGuards = 0;
                var totalReservers = 0, requiredReservers = 0;
                var totalWorkers = 0, requiredWorkers = 0;
                for (flag of flag.room.flags) {
                    totalReservers += flag.getAssignedCreepAmounts('reserver');
                    totalGuards += flag.getAssignedCreepAmounts('guard');
                    totalMiners += flag.getAssignedCreepAmounts('miner');
                    // totalHaulers += flag.getAssignedCreepAmounts('hauler');
                    totalWorkers += flag.getAssignedCreepAmounts('worker');
                    requiredReservers += flag.getRequiredCreepAmounts('reserver');
                    requiredGuards += flag.getRequiredCreepAmounts('guard');
                    requiredMiners += flag.getRequiredCreepAmounts('miner');
                    // requiredHaulers += flag.getRequiredCreepAmounts('hauler');
                    requiredWorkers += flag.getRequiredCreepAmounts('worker');
                }
                info = totalGuards + "/" + requiredGuards + "G " +
                       totalReservers + "/" + requiredReservers + "R " +
                       totalMiners + "/" + requiredMiners + "M " +
                       // totalHaulers + "/" + requiredHaulers + "H " +
                       totalWorkers + "/" + requiredWorkers + "W";
            }
            text.push("  " + icon + " " + flag.roomName + ": " + info);
        }
        Memory.visuals.HUD.occupiedRoomInfo = text;
        Memory.visuals.HUD.lastCalculated = Game.time;
    },

    drawRoomInfo: function () {
        fontSize = 0.5 * fontScale;
        style.font = fontSize + " Courier";
        row = new RoomVisual().multitext(Memory.visuals.HUD.ownedRoomInfo, column, row, fontSize, style);
        row = new RoomVisual().multitext(Memory.visuals.HUD.occupiedRoomInfo, column, row, fontSize, style);
    },

    draw: function () {
        this.verifyMemory();
        this.drawLogo();
        this.drawCpuInfo();
        // Don't display at expense of CPU
        fontSize = 0.5 * fontScale;
        style.font = fontSize + " Courier";

        if (Game.cpu.bucket > 9500 || Game.time % 25 == 0) {
            this.getOwnedRoomInfo();
            this.getOccupiedRoomInfo();
            this.drawRoomInfo();
        } else {
            this.drawRoomInfo();
            let dt = Game.time - Memory.visuals.HUD.lastCalculated;
            style.color = "#ff0000";
            new RoomVisual().text("Low CPU: cached data (" + dt + " ticks old)",
                                  column, row, style);
        }
    }
};

// const profiler = require('screeps-profiler');
profiler.registerObject(HUD, 'HUD');

module.exports = HUD;