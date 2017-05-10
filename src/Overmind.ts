// Overmind class - manages colony-scale operations and contains references to all brain objects

import {RoomBrain} from "./brains/Brain_Room";
import {TerminalBrain} from "./brains/Brain_Terminal";
import profiler = require('./lib/screeps-profiler');
import {Colony} from "./Colony";
import {Overlord} from "./Overlord";

export default class Overmind {
    name: string;
    RoomBrains: { [roomName: string]: RoomBrain };
    TerminalBrains: { [roomName: string]: TerminalBrain };
    Colonies: { [roomName: string]: Colony };
    Overlords: { [roomName: string]: Overlord };

    constructor() {
        this.name = "Overmind";
        this.RoomBrains = {};
        this.TerminalBrains = {};
        this.Colonies = {};
        this.Overlords = {};
    }

    initializeColonies(): void {
        // Colony call object
        let protoColonies = {} as { [roomName: string]: string[] }; // key: lead room, values: outposts[]
        // Register colony capitols
        for (let name in Game.rooms) {
            if (Game.rooms[name].my) { // Add a new colony for each owned room
                Game.rooms[name].memory.colony = name; // register colony to itself
                protoColonies[name] = [];
            }
        }
        // Register colony outposts
        let colonyFlags = _.filter(Game.flags, flagCodes.territory.colony.filter);
        for (let flag of colonyFlags) {
            let colonyName = flag.memory.colony;
            let roomName = flag.pos.roomName;
            let thisRoom = Game.rooms[roomName];
            if (thisRoom) { // If there's vision, assign the room to a colony
                thisRoom.memory.colony = colonyName;
                protoColonies[colonyName].push(roomName);
            } else { // Else set it to null
                protoColonies[colonyName].push("");
            }
        }
        // Initialize the colonies
        for (let colName in protoColonies) {
            this.Colonies[colName] = new Colony(colName, protoColonies[colName]);
        }
    }

    spawnMoarOverlords(): void {
        // Instantiate an overlord for each colony
        for (let name in this.Colonies) {
            this.Overlords[name] = new Overlord(name);
        }
    }

    initializeAllBrains(): void {
        for (let name in Game.rooms) {
            this.RoomBrains[name] = new RoomBrain(name);
            if (Game.rooms[name].terminal != undefined) {
                this.TerminalBrains[name] = new TerminalBrain(name);
            }
        }
    }
}


profiler.registerClass(Overmind, 'Overmind');