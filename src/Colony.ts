// Colony class - organizes all assets of an owned room into a colony

import {Hatchery} from "./baseComponents/Hatchery";
import {MiningSite} from "./baseComponents/MiningSite";
import {pathing} from "./pathing/pathing";


export class Colony implements IColony {
    name: string;
    memory: any;
    room: Room;
    outposts: Room[];
    rooms: Room[];
    hatchery: Hatchery;
    storage: StructureStorage;
    terminal: StructureTerminal;
    incubating: boolean;
    flags: Flag[];
    creeps: ICreep[];
    creepsByRole: { [roleName: string]: ICreep[] };
    sources: Source[];
    miningSites: { [sourceID: string]: MiningSite };

    constructor(roomName: string, outposts: string[]) {
        // Name the colony
        this.name = roomName;
        // Set up memory if needed
        if (!Memory.colonies[this.name]) {
            Memory.colonies[this.name] = {
                overlord: {},
                hatchery: {},
            }
        }
        this.memory = Memory.colonies[this.name];
        // Register colony capitol and associated components
        this.room = Game.rooms[roomName];
        this.outposts = _.map(outposts, outpost => Game.rooms[outpost]);
        this.rooms = [Game.rooms[roomName]].concat(this.outposts);
        // Associate unique colony components
        this.hatchery = new Hatchery(this);
        this.storage = this.room.storage;
        this.terminal = this.room.terminal;
        this.incubating = (_.filter(this.room.flags, flagCodes.territory.claimAndIncubate.filter).length > 0);
        // Register things across all rooms
        this.flags = _.flatten(_.map(this.rooms, room => room.flags));
        this.sources = _.flatten(_.map(this.rooms, room => room.sources));
        // Mining sites is an object of ID's and MiningSites
        let sourceIDs = _.map(this.sources, source => source.ref);
        let miningSites = _.map(this.sources, source => new MiningSite(source));
        this.miningSites = _.zipObject(sourceIDs, miningSites) as { [sourceID: string]: MiningSite };
        // Register sensible room structure groups across rooms
    }

    get haulingPowerNeeded(): number { // total amount of hauling power for all mining sites, units of CARRY parts
        let haulingPower = 0;
        if (!this.storage) { // haulers aren't spawned until there is a storage structure
            return 0;
        }
        for (let siteID in this.miningSites) {
            let site = this.miningSites[siteID];
            if (site.output instanceof StructureContainer) { // only count container mining sites
                haulingPower += site.energyPerTick * (2 * pathing.cachedPathLength(this.storage.pos, site.pos));
            }
        }
        return haulingPower / CARRY_CAPACITY;
    }

    get overlord(): IOverlord {
        return Overmind.Overlords[this.name];
    }

    getCreepsByRole(roleName: string): ICreep[] {
        return this.creepsByRole[roleName] || [];
    }
}