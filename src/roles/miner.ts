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
        // Are you out of energy?
        if (this.carry.energy == 0) { // If yes, get more energy
            this.task = new taskHarvest(this.assignment);
        } else { // If no, continue
            // Is there an output to the miningSite?
            if (this.miningSite.output) { // If there is output, repair or deposit to it
                // Is the miningSite output at full health?
                if (this.miningSite.output.hits == this.miningSite.output.hitsMax) { // yes: deposit to it
                    this.task = new taskDeposit(this.miningSite.output);
                } else { // no: repair it
                    this.task = new taskRepair(this.miningSite.output);
                }
            } else { // If no output, build one
                // Is there a construction site for the output?
                if (this.miningSite.outputConstructionSite) { // yes: build output
                    this.task = new taskBuild(this.miningSite.outputConstructionSite);
                } else { // no: make a construction site for the output
                    this.room.createConstructionSite(this.pos, STRUCTURE_CONTAINER);
                }
            }
        }
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

