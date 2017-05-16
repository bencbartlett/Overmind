// Miner - stationary harvester for container mining. Fills containers and sits in place.

import {taskBuild} from "../tasks/task_build";
import {taskRepair} from "../tasks/task_repair";
import {taskDeposit} from "../tasks/task_deposit";
import {taskHarvest} from "../tasks/task_harvest";
import {AbstractCreep, AbstractSetup} from "./Abstract";
import {MiningSite} from "../baseComponents/MiningSite";

export class MinerSetup extends AbstractSetup {
    constructor() {
        super('miner');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, WORK, CARRY, MOVE];
        this.settings.allowBuild = true;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(WORK) > 1 &&
                                                  creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }
}

export class MinerCreep extends AbstractCreep {
    assignment: Source;
    miningSite: MiningSite;

    constructor(creep: Creep) {
        super(creep);
        this.miningSite = this.colony.miningSites[this.assignment.ref];
    }

    newTask() {
        // Clear the task
        this.task = null;

        // If you have no energy, get some
        if (this.carry.energy == 0) {
            return this.assign(new taskHarvest(this.assignment));
        }

        // Ensure that the mining site has an output
        if (!this.miningSite.output) {
            if (this.miningSite.outputConstructionSite) {
                // Build the output
                return this.assign(new taskBuild(this.miningSite.outputConstructionSite));
            } else {
                // If there isn't a site for the output, make one
                return this.room.createConstructionSite(this.pos, STRUCTURE_CONTAINER);
            }
        }

        // Repair the output if necessary
        if (this.miningSite.output.hits < this.miningSite.output.hitsMax) {
            return this.assign(new taskRepair(this.miningSite.output));
        }

        // Deposit to the output
        return this.assign(new taskDeposit(this.miningSite.output));
    }

    onRun() {
        if (this.getActiveBodyparts(WORK) < 0.75 * this.getBodyparts(WORK)) {
            this.suicide(); // kill off miners that might have gotten damaged so they don't sit and try to mine
        }
        if (this.colony.incubating) {
            if (this.carry.energy == 0) { // request renewal after a mining cycle is finished
                this.renewIfNeeded();
            }
        }
    }
}

