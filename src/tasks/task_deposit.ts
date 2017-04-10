import {Task} from "./Task";

export class taskDeposit extends Task {
    target: StructureContainer | StructureStorage | StructureTerminal | StructureLink;

    constructor() {
        super('deposit');
        // Settings
        this.moveColor = 'blue';
        this.data.quiet = true;
    }

    isValidTask() {
        var creep = this.creep;
        return (creep.carry.energy > 0);
    }

    isValidTarget() {
        var target = this.target;
        if (target.structureType == STRUCTURE_CONTAINER ||
            target.structureType == STRUCTURE_STORAGE ||
            target.structureType == STRUCTURE_TERMINAL) {
            let tgt = target as StructureContainer | StructureStorage | StructureTerminal;
            return (_.sum(tgt.store) < tgt.storeCapacity);
        } else if (target.structureType == STRUCTURE_LINK) {
            let tgt = target as StructureLink;
            return tgt.energy < tgt.energyCapacity;
        } else {
            return false;
        }
    }

    work() {
        return this.creep.transfer(this.target, RESOURCE_ENERGY);
    }
}

