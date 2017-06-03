// All objectives required for colony homeostasis

import {Objective} from './Objective';
import {TaskPickup} from '../tasks/task_pickup';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskSupply} from '../tasks/task_supply';
import {TaskRepair} from '../tasks/task_repair';
import {TaskBuild} from '../tasks/task_build';
import {TaskFortify} from '../tasks/task_fortify';
import {TaskUpgrade} from '../tasks/task_upgrade';

// Objective to pick up dropped energy in a room
export class ObjectivePickupEnergy extends Objective {
	target: Resource;

	constructor(target: Resource) {
		super('pickupEnergy', target);
		this.assignableToRoles = ['hauler'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(CARRY) > 0 &&
			   creep.carry.energy < creep.carryCapacity;
	}

	getTask() {
		return new TaskPickup(this.target);
	}
}

// Objective to collect energy from a container
export class ObjectiveCollectEnergyContainer extends Objective {
	target: Container;

	constructor(target: Container) {
		super('collectEnergyContainer', target);
		this.assignableToRoles = ['hauler'];
		this.maxCreeps = Infinity;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(CARRY) > 0 &&
			   creep.carry.energy < 0.5 * creep.carryCapacity;
	}

	getTask() {
		return new TaskWithdraw(this.target);
	}
}

// Objective to collect energy from a container that is part of a mining site
export class ObjectiveCollectEnergyMiningSite extends Objective {
	target: Container;

	constructor(target: Container) {
		super('collectEnergyMiningSite', target);
		this.assignableToRoles = ['hauler'];
		this.maxCreeps = Infinity;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   this.target.miningSite.predictedStore >= 0.75 * (creep.carryCapacity - _.sum(creep.carry)) &&
			   creep.getActiveBodyparts(CARRY) > 0;
	}

	getTask() {
		return new TaskWithdraw(this.target);
	}
}

// Objective to supply energy to a tower
export class ObjectiveSupplyTower extends Objective {
	target: Tower;

	constructor(target: Tower) {
		super('supplyTower', target);
		this.assignableToRoles = ['supplier'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(CARRY) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskSupply(this.target);
	}
}

// Objective to supply energy to a sink
export class ObjectiveSupply extends Objective {
	target: Sink;

	constructor(target: Sink) {
		super('supply', target);
		this.assignableToRoles = ['supplier'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(CARRY) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskSupply(this.target);
	}
}

// Objective to repair a structure
export class ObjectiveRepair extends Objective {
	target: Structure;

	constructor(target: Structure) {
		super('repair', target);
		this.assignableToRoles = ['worker', 'miner'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(WORK) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskRepair(this.target);
	}
}

// Objective to build a construction site
export class ObjectiveBuild extends Objective {
	target: ConstructionSite;

	constructor(target: ConstructionSite) {
		super('build', target);
		this.assignableToRoles = ['worker', 'miner'];
		this.maxCreeps = 3;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(WORK) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskBuild(this.target);
	}
}

// Objective to build a road site
export class ObjectiveBuildRoad extends Objective {
	target: ConstructionSite;

	constructor(target: ConstructionSite) {
		super('buildRoad', target);
		this.assignableToRoles = ['worker'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(WORK) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskBuild(this.target);
	}
}

// Objective to fortify walls
export class ObjectiveFortify extends Objective {
	target: StructureWall | StructureRampart;

	constructor(target: StructureWall | StructureRampart) {
		super('fortify', target);
		this.assignableToRoles = ['worker'];
		this.maxCreeps = 1;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(WORK) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskFortify(this.target);
	}
}

// Objective to upgrade the controller
export class ObjectiveUpgrade extends Objective {
	target: StructureController;

	constructor(target: StructureController) {
		super('upgrade', target);
		this.assignableToRoles = ['upgrader', 'worker'];
		this.maxCreeps = Infinity;
	}

	assignableTo(creep: ICreep) {
		return this.assignableToRoles.includes(creep.memory.role) &&
			   creep.getActiveBodyparts(WORK) > 0 &&
			   creep.carry.energy > 0;
	}

	getTask() {
		return new TaskUpgrade(this.target);
	}
}

