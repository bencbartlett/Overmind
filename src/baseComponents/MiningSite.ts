// Mining site class for grouping relevant components

export class MiningSite implements IMiningSite {
    name: string;
    room: Room;
    pos: RoomPosition;
    source: Source;
    energyPerTick: number;
    miningPowerNeeded: number;
    output: Container | Link | null;
    fullness: number | undefined;
    miners: Creep[];

    constructor(source: Source) {
        this.source = source;
        this.name = source.ref;
        this.pos = source.pos;
        this.room = source.room;
        this.energyPerTick = source.energyCapacity / ENERGY_REGEN_TIME;
        this.miningPowerNeeded = Math.ceil(this.energyPerTick / HARVEST_POWER) + 1;
        // Register output method
        this.output = null;
        this.fullness = undefined;
        let nearbyContainers = this.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (s:Structure) => s.structureType == STRUCTURE_CONTAINER
        }) as Container[];
        if (nearbyContainers.length > 0) {
            this.output = nearbyContainers[0];
            this.fullness = _.sum(this.output.store) / this.output.storeCapacity;
        }
        let nearbyLinks = this.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (s:Structure) => s.structureType == STRUCTURE_LINK
        }) as Link[];
        if (nearbyLinks.length > 0) {
            this.output = nearbyLinks[0];
            this.fullness = this.output.energy / this.output.energyCapacity;
        }
        this.miners = source.getAssignedCreeps('miner');
    }
}