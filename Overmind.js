// Overmind class - manages colony-scale operations and contains references to all brain objects

class Overmind {
    constructor() {
        this.name = "Overmind";
        this.RoomBrains = {};
        this.TerminalBrains = {};
    }

    initializeAllBrains() {
        var roomBrain = require('Brain_Room');
        var terminalBrain = require('Brain_Terminal');
        for (let name in Game.rooms) {
            this.RoomBrains[name] = new roomBrain(name);
            if (Game.rooms[name].terminal != undefined) {
                this.TerminalBrains[name] = new terminalBrain(name);
            }
        }
    }
}

profiler.registerClass(Overmind, 'Overmind');

module.exports = Overmind;