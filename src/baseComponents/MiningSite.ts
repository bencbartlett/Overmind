// Mining site class for grouping relevant components

export class MiningSite implements IMiningSite {
    name: string;
    room: Room;
    pos: RoomPosition;
    source: Source;
    energyPerTick: number;
    miningPowerNeeded: number;
    output: Container | Link | null;
    fullness: number;
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
        this.fullness = 0;
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

    get predictedStore(): number {
        // This should really only be used on container sites
        if (this.output instanceof StructureContainer) {
            let targetingCreeps = _.map(this.output.targetedBy, name => Game.creeps[name]);
            // Assume all haulers are withdrawing from mining site so you don't have to scan through tasks
            let targetingHaulers = _.filter(targetingCreeps, creep => creep.memory.role == 'hauler');
            // Return storage minus the amount that currently assigned haulers will withdraw
            return _.sum(this.output.store) - _.sum(_.map(targetingHaulers,
                                                          hauler => hauler.carryCapacity - _.sum(hauler.carry)));
        } else if (this.output instanceof StructureLink) {
            return this.output.energy;
        }
    }
}