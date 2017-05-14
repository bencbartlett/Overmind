// Colony class - organizes all assets of an owned room into a colony

import {Hatchery} from "./baseComponents/Hatchery";
import {MiningSite} from "./baseComponents/MiningSite";
import {pathing} from "./pathing/pathing";


export class Colony implements IColony {
    name: string;
    room: Room;
    outposts: Room[];
    rooms: Room[];
    hatchery: Hatchery;
    storage: StructureStorage;
    terminal: StructureTerminal;
    incubating: boolean;
    flags: Flag[];
    creeps: Creep[];
    sources: Source[];
    miningSites: MiningSite[];

    constructor(roomName: string, outposts: string[]) {
        // Register colony capitol and associated components
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.outposts = _.map(outposts, outpost => Game.rooms[outpost]);
        this.rooms = [Game.rooms[roomName]].concat(this.outposts);
        // Associate unique colony components
        this.hatchery = new Hatchery(roomName);
        this.storage = this.room.storage;
        this.terminal = this.room.terminal;
        this.incubating = (_.filter(this.room.flags, flagCodes.territory.claimAndIncubate.filter).length > 0);
        // Register things across all rooms
        this.flags = _.flatten(_.map(this.rooms, room => room.flags));
        this.sources = _.flatten(_.map(this.rooms, room => room.sources));
        this.miningSites = _.map(this.sources, source => new MiningSite(source));
    }

    get haulingPowerNeeded(): number { // sum all total amount of hauling power for all mining sites
        let haulingPower = 0;
        if (!this.storage) { // haulers aren't spawned until there is a storage structure
            return 0;
        }
        for (let site of this.miningSites) {
            if (site.output instanceof StructureContainer) { // only count container mining sites
                haulingPower += site.energyPerTick * (2 * pathing.cachedPathLength(this.storage.pos, site.pos));
            }
        }
        return haulingPower;
    }

    get overlord(): IOverlord {
        return Overmind.Overlords[this.name];
    }
}