// Overmind class - manages colony-scale operations and contains references to all brain objects
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Brain_Room_1 = require("./brains.Brain_Room");
const Brain_Terminal_1 = require("./brains.Brain_Terminal");
class Overmind {
    constructor() {
        this.name = "Overmind";
        this.RoomBrains = {};
        this.TerminalBrains = {};
    }
    initializeAllBrains() {
        for (let name in Game.rooms) {
            this.RoomBrains[name] = new Brain_Room_1.RoomBrain(name);
            if (Game.rooms[name].terminal != undefined) {
                this.TerminalBrains[name] = new Brain_Terminal_1.TerminalBrain(name);
            }
        }
    }
}
exports.default = Overmind;
const profiler = require("./lib.screeps-profiler");
profiler.registerClass(Overmind, 'Overmind');
