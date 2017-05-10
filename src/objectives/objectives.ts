// All objectives required for colony homeostasis

import {Objective} from "./Objective";
import {taskPickup} from "../tasks/task_pickup";
import {taskRecharge} from "../tasks/task_recharge";
import {taskSupply} from "../tasks/task_supply";
import {taskRepair} from "../tasks/task_repair";
import {taskBuild} from "../tasks/task_build";

export class pickupEnergyObjective extends Objective {
    target: Resource;

    constructor(target: Resource) {
        super('pickupEnergy', target);
    }

    assignableTo(creep: Creep) {
        return creep.memory.role == 'hauler' &&
               creep.getActiveBodyparts(CARRY) > 0 &&
               creep.carry.energy < creep.carryCapacity;
    }

    getTask() {
        return new taskPickup(this.target);
    }
}

export class collectEnergyContainerObjective extends Objective {
    target: Container;

    constructor(target: Container) {
        super('collectEnergyContainer', target);
    }

    assignableTo(creep: Creep) {
        return creep.memory.role == 'hauler' &&
               creep.getActiveBodyparts(CARRY) > 0 &&
               creep.carry.energy < creep.carryCapacity;
    }

    getTask() {
        return new taskRecharge(this.target);
    }
}

export class supplyTowerObjective extends Objective {
    target: Tower;

    constructor(target: Tower) {
        super('supplyTower', target);
    }

    assignableTo(creep: Creep) {
        return creep.memory.role == 'supplier' &&
               creep.getActiveBodyparts(CARRY) > 0 &&
               creep.carry.energy > 0;
    }

    getTask() {
        return new taskSupply(this.target);
    }
}

export class supplyObjective extends Objective {
    target: Sink;

    constructor(target: Sink) {
        super('supply', target);
    }

    assignableTo(creep: Creep) {
        return creep.memory.role == 'supplier' &&
               creep.getActiveBodyparts(CARRY) > 0 &&
               creep.carry.energy > 0;
    }

    getTask() {
        return new taskSupply(this.target);
    }
}

export class repairObjective extends Objective {
    target: Structure;

    constructor(target: Structure) {
        super('repair', target);
    }

    assignableTo(creep: Creep) {
        return (creep.memory.role == 'worker' || creep.memory.role == 'miner' || creep.memory.role == 'guard') &&
               creep.getActiveBodyparts(WORK) > 0 &&
               creep.carry.energy > 0;
    }

    getTask() {
        return new taskRepair(this.target);
    }
}

export class buildObjective extends Objective {
    target: ConstructionSite;

    constructor(target: ConstructionSite) {
        super('build', target);
    }

    assignableTo(creep: Creep) {
        return (creep.memory.role == 'worker' || creep.memory.role == 'miner' || creep.memory.role == 'guard') &&
               creep.getActiveBodyparts(WORK) > 0 &&
               creep.carry.energy > 0;
    }

    getTask() {
        return new taskBuild(this.target);
    }
}

export class buildRoadObjective extends Objective {
    target: ConstructionSite;

    constructor(target: ConstructionSite) {
        super('buildRoad', target);
    }

    assignableTo(creep: Creep) {
        return (creep.memory.role == 'worker' || creep.memory.role == 'miner' || creep.memory.role == 'guard') &&
               creep.getActiveBodyparts(WORK) > 0 &&
               creep.carry.energy > 0;
    }

    getTask() {
        return new taskBuild(this.target);
    }
}