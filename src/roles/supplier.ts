// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage

import {AbstractCreep, AbstractSetup} from './Abstract';
import {TaskWithdraw} from '../tasks/task_withdraw';


export class SupplierSetup extends AbstractSetup {
	constructor() {
		super('supplier');
		// Role-specific settings
		this.settings.bodyPattern = [CARRY, CARRY, MOVE];
		// this.settings.consoleQuiet = true; // suppliers should shut the fuck up
		this.settings.notifyOnNoRechargeTargets = true;
		this.settings.notifyOnNoTask = false;
		this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
												  creep.getActiveBodyparts(CARRY) > 1;
	}

	onCreate(creep: protoCreep) {
		let colonyRoom = Game.rooms[creep.memory.colony];
		let idleFlag = _.filter(colonyRoom.flags,
								flag => flagCodes.rally.idlePoint.filter(flag) &&
										(flag.memory.role == this.name || flag.name.includes(this.name)))[0];
		if (idleFlag) {
			creep.memory.data.idleFlag = idleFlag.name;
		}
		return creep;
	}
}

export class SupplierCreep extends AbstractCreep {
	assignment: Spawn;
	hatchery: IHatchery;

	constructor(creep: Creep) {
		super(creep);
	}

	init() {
		this.hatchery = this.colony.hatchery;
	}


	/* Recharge from link if possible, else try to recharge from battery, else complain */
	recharge(): void {
		if (this.hatchery.link && !this.hatchery.link.isEmpty) {
			this.task = new TaskWithdraw(this.hatchery.link);
		} else if (this.hatchery.battery && !this.hatchery.battery.isEmpty) {
			this.task = new TaskWithdraw(this.hatchery.battery);
		} else {
			this.log('Hatchery is out of energy!');
			let target = this.pos.findClosestByRange(this.room.storageUnits, {
				filter: (s: StorageUnit) => (s instanceof StructureContainer && !s.isEmpty) ||
											(s instanceof StructureStorage && s.creepCanWithdrawEnergy(this)),
			}) as StorageUnit;
			if (target) { // assign recharge task to creep
				this.task = new TaskWithdraw(target);
			} else {
				this.say('Can\'t recharge');
			}
		}
	}

	/* Overwrite the default requestTask method to only receive tasks from the hatchery. */
	requestTask(): void {
		this.colony.hatchery.objectiveGroup.assignTask(this);
	}

	newTask(): void {
		this.task = null;
		if (this.carry.energy == 0) {
			this.recharge();
		} else {
			this.requestTask();
		}
	}

	onRun(): void {
		let suppliers = this.colony.getCreepsByRole('supplier');
		for (let supplier of suppliers) {
			// Delete emergency suppliers in the case a larger one is available
			if (supplier.name != this.name &&
				supplier.getActiveBodyparts(CARRY) > this.getActiveBodyparts(CARRY) &&
				this.getActiveBodyparts(CARRY) == 2) {
				this.log('A larger supplier is available, time to die!');
				this.suicide();
			}
		}
	}
}
