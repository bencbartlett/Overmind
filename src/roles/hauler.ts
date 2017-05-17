// Hauler - brings back energy from reserved outposts

import {taskDeposit} from "../tasks/task_deposit";
import {AbstractCreep, AbstractSetup} from "./Abstract";

export class HaulerSetup extends AbstractSetup {
    constructor() {
        super('hauler');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        this.settings.bodySuffix = [WORK, MOVE];
        this.settings.proportionalPrefixSuffix = false;
        this.settings.consoleQuiet = true;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }
}

export class HaulerCreep extends AbstractCreep {

    constructor(creep: Creep) {
        super(creep);
    }

    doDeposit() {
        let target: StructureContainer | StructureStorage;
        let depositContainers = _.filter(this.colony.room.sinkContainers,
                                         s => s.storeCapacity - s.store[RESOURCE_ENERGY] > 0.75 * this.carryCapacity);
        if (depositContainers.length > 0) {
            target = depositContainers[0];
        } else {
            target = this.colony.storage;
        }
        if (target) {
            return this.assign(new taskDeposit(target));
        }
    }

    newTask() {
        this.task = null;
        if (this.carry.energy == 0) {
            this.requestTask(); // Get a collection task from the overlord
        } else {
            this.doDeposit(); // Deposit to the best target
        }
    }

    onRun() {
        // Pickup any dropped energy along your route
        let droppedEnergy = this.pos.findInRange(FIND_DROPPED_ENERGY, 1)[0] as Resource;
        if (droppedEnergy) {
            this.pickup(droppedEnergy);
            if (droppedEnergy.amount > 0.5 * this.carryCapacity) {
                this.doDeposit();
            }
        }
        // Repair nearby roads as you go
        this.repairNearbyDamagedRoad(); // repair roads if you are capable
    }
}

