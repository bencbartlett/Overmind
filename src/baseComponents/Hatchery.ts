// Hatchery - groups all spawns in a colony

import {Colony} from "../Colony";

export class Hatchery {
    name: string;
    room: Room;
    memory: any;
    pos: RoomPosition;
    spawns: Spawn[];
    availableSpawns: Spawn[];
    extensions: Extension[];
    productionQueue: { [priority: number]: protoCreep[] };

    constructor(colony: Colony) {
        // Set up hatchery, register colony and memory
        this.name = colony.name;
        this.room = colony.room;
        this.memory = colony.memory.hatchery;
        // Register roomobject components
        this.spawns = this.room.spawns;
        this.availableSpawns = _.filter(this.room.spawns, (spawn: Spawn) => !spawn.spawning);
        this.extensions = this.room.extensions;
        // Spawns should all be close, position is pos of head
        if (this.spawns[0]) {
            this.pos = this.spawns[0].pos;
        } else {
            this.pos = null;
        }
        // Set up production queue in memory so we can inspect it easily
        this.memory.productionQueue = {}; // cleared every tick; only in memory for inspection purposes
        this.productionQueue = this.memory.productionQueue; // reference this outside of memory for typing purposes
    }

    generateCreepName = function (roleName: string): string {
        // generate a creep name based on the role and add a suffix to make it unique
        let i = 0;
        while (Game.creeps[(roleName + '_' + i)]) {
            i++;
        }
        return (roleName + '_' + i);
    };

    createCreep(protoCreep: protoCreep): number | string {
        if (this.availableSpawns.length == 0) {
            return ERR_BUSY;
        } else {
            let spawnToUse = this.availableSpawns.shift(); // get a spawn to use
            protoCreep.name = this.generateCreepName(protoCreep.name); // modify the creep name to make it unique
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