// Overmind class - manages colony-scale operations and contains references to all brain objects

import {RoomBrain} from "./brains/Brain_Room";
import {TerminalBrain} from "./brains/Brain_Terminal";

export default class Overmind {
    name: string;
    RoomBrains: {[name: string]: RoomBrain};
    TerminalBrains: {[name:string]: TerminalBrain};
    constructor() {
        this.name = "Overmind";
        this.RoomBrains = {};
        this.TerminalBrains = {};
    }

    initializeAllBrains() {
        for (let name in Game.rooms) {
            this.RoomBrains[name] = new RoomBrain(name);
            if (Game.rooms[name].terminal != undefined) {
                this.TerminalBrains[name] = new TerminalBrain(name);
            }
        }
    }
}

import profiler = require('./lib/screeps-profiler');
profiler.registerClass(Overmind, 'Overmind');