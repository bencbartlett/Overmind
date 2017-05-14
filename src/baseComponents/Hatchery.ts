// Hatchery - groups all spawns in a colony

export class Hatchery {
    name: string;
    room: Room;
    pos: RoomPosition;
    spawns: Spawn[];
    availableSpawns: Spawn[];
    extensions: Extension[];
    productionQueue: { [priority: number]: protoCreep[] };

    constructor(roomName: string) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.spawns = this.room.spawns;
        this.availableSpawns = _.filter(this.room.spawns, (spawn: Spawn) => !spawn.spawning);
        this.extensions = this.room.extensions;
        if (this.spawns[0]) {
            this.pos = this.spawns[0].pos;
        } else {
            this.pos = null;
        }
        this.productionQueue = {};
    }

    createCreep(protoCreep: protoCreep): number | string {
        if (this.availableSpawns.length == 0) {
            return ERR_BUSY;
        } else {
            let spawnToUse = this.availableSpawns.shift(); // get a spawn to use
            let result = spawnToUse.createCreep(protoCreep.body, protoCreep.name, protoCreep.memory);
            if (result == OK) {
                return result;
            } else {
                this.availableSpawns.unshift(spawnToUse); // return the spawn to the available spawns list
                return result;
            }
        }
    }

    enqueue(protoCreep: protoCreep, priority?: number): void {
        if (priority == undefined) {
            priority = 1000; // some large but finite priority for all the remaining stuff to make
        }
        if (!this.productionQueue[priority]) {
            this.productionQueue[priority] = [];
        }
        this.productionQueue[priority].push(protoCreep);
    }

    spawnHighestPriorityCreep(): number | string {
        let priorities: number[] = _.map(Object.keys(this.productionQueue), key => parseInt(key)).sort();
        for (let priority of priorities) {
            if (this.productionQueue[priority].length > 0) {
                let protocreep = this.productionQueue[priority].shift();
                let result = this.createCreep(protocreep);
                if (result == OK) {
                    return result;
                } else {
                    this.productionQueue[priority].unshift(protocreep);
                    return result;
                }
            }
        }
    }

    run(): void {
        while (this.availableSpawns.length > 0) {
            if (this.spawnHighestPriorityCreep() != OK) {
                break;
            }
        }
    }

    get uptime(): number { // TODO
        // Calculate the approximate rolling average uptime
        return 0;
    }

    get energySpentInLastLifetime(): number { // TODO
        // Energy spent making creeps over the last 1500 ticks
        return 0;
    }
}