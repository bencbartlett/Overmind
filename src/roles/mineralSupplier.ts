// Mineral supplier - supplied minerals to labs for boosting and processing

import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskTransfer} from '../tasks/task_transfer';
import {AbstractCreep, AbstractSetup} from './Abstract';
import {profile} from '../lib/Profiler';

@profile
export class MineralSupplierSetup extends AbstractSetup {
	constructor() {
		super('mineralSupplier');
		// Role-specific settings
		this.body.pattern = [CARRY, CARRY, MOVE];
	}
}

@profile
export class MineralSupplierCreep extends AbstractCreep {

	constructor(creep: Creep) {
		super(creep);
	}

	collectForLab(lab: StructureLab) {
		let term = this.colony.terminal;
		if (term) {
			let amount = term.store[<ResourceConstant>lab.assignedMineralType];
			if (amount && amount > 0) {
				var withdrawThis = new TaskWithdraw(term);
				withdrawThis.data.resourceType = lab.assignedMineralType;
				this.task = withdrawThis;
			}
		}
	}

	depositForLab(lab: StructureLab) {
		var transfer = new TaskTransfer(lab);
		transfer.data.resourceType = lab.assignedMineralType;
		this.task = transfer;
	}

	newTask() {
		this.task = null;
		let loadLabs = _.filter(this.room.labs,
								(lab: StructureLab) => lab.IO == 'in' &&
													   lab.mineralAmount < lab.maxAmount - this.carryCapacity);
		if (loadLabs.length > 0) {
			let lab = loadLabs[0];
			if (_.sum(this.carry) == 0) {
				this.collectForLab(lab);
			} else {
				this.depositForLab(lab);
			}
		}
	}

	onRun() {
		if (this.ticksToLive < 100 && _.sum(this.carry) == 0) {
			this.suicide();
		}
	}
}
