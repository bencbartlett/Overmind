// Miner - stationary harvester for container mining. Fills containers and sits in place.
import {Role} from "./Role";
// import {tasks} from "../maps/map_tasks";
import {taskBuild} from "../tasks/task_build";
import {taskRepair} from "../tasks/task_repair";
import {taskDeposit} from "../tasks/task_deposit";
import {taskHarvest} from "../tasks/task_harvest";
import {taskGoToRoom} from "../tasks/task_goToRoom";

export class roleMiner extends Role {
    constructor() {
        super('miner');
        // Role-specific settings
        this.settings.bodyPattern = [WORK, WORK, CARRY, MOVE];
        // this.settings.remoteBodyPattern = [WORK, WORK, CARRY, MOVE, MOVE];
        this.settings.allowBuild = true;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(WORK) > 1 &&
                                                  creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }

    buildSite(creep: Creep, containerSite: ConstructionSite) {
        return creep.assign(new taskBuild(containerSite));
    }

    repairContainer(creep: Creep, container: Container) {
        return creep.assign(new taskRepair(container));
    }

    depositContainer(creep: Creep) {
        // select emptiest of containers that are within range 1 of creep (helps with adjacent sources)
        var target = _.sortBy(creep.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (s: Structure) => s.structureType == STRUCTURE_CONTAINER,
        }), (container: Container) => container.store[RESOURCE_ENERGY])[0] as Container;
        if (target) {
            creep.moveTo(target); // get on top of the container if you're not already
            return creep.assign(new taskDeposit(target));
        }
        // else {
        //     return this.dropEnergy(creep);
        // }
    }

    depositLink(creep: Creep) {
        // select emptiest of containers that are within range 1 of creep (helps with adjacent sources)
        var target = _.sortBy(creep.pos.findInRange(FIND_MY_STRUCTURES, 2, {
            filter: (s: Link) => s.structureType == STRUCTURE_LINK && s.energy < s.energyCapacity,
        }), (link: Link) => link.energy)[0] as Link;
        if (target) {
            return creep.assign(new taskDeposit(target));
        }
    }

    harvest(creep: Creep) {
        var target;
        if (creep.assignment.room) {
            target = creep.assignment.pos.lookFor(LOOK_SOURCES)[0] as Source;
            return creep.assign(new taskHarvest(target));
        } else {
            target = creep.assignment;
            return creep.assign(new taskGoToRoom(target));
        }

    }

    newTask(creep: Creep) {
        creep.task = null;
        // 1: harvest when empty
        if (creep.carry.energy == 0) {
            return this.harvest(creep);
        }
        // 1.5: log first time of deposit or build tasks as replacement time
        if (creep.memory.data.replaceAt == 0) {
            creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 20;
        }
        // 2: find any nearby damaged containers and repair them
        var damagedContainers = creep.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (s: Structure) => s.structureType == STRUCTURE_CONTAINER && s.hits < s.hitsMax,
        }) as Container[];
        if (damagedContainers.length > 0) {
            return this.repairContainer(creep, damagedContainers[0]);
        }
        // 3: build construction sites
        if (this.settings.allowBuild) {
            // miners can only build their own containers
            var constructionSites = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2, {
                filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER
            }) as ConstructionSite[];
            if (constructionSites.length > 0) {
                return this.buildSite(creep, creep.pos.findClosestByRange(constructionSites));
            }
        }
        // 4: deposit into link or container
        if (creep.assignment.linked) {
            return this.depositLink(creep);
        } else {
            return this.depositContainer(creep);
        }
    }

    onRun(creep: Creep) {
        if (creep.getActiveBodyparts(WORK) < 0.75 * creep.getBodyparts(WORK)) {
            creep.suicide(); // kill off miners that might have gotten damaged so they don't sit and try to mine
        }
        if (creep.room.brain.incubating) {
            if (creep.carry.energy == 0) { // request renewal after a mining cycle is finished
                this.renewIfNeeded(creep);
            }
        }
    }
}
