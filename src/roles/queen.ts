// Queen: dedicated supplier for the hatchery

import {AbstractCreep, AbstractSetup} from './Abstract';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {log} from '../lib/logger/log';
import {profile} from '../lib/Profiler';

@profile
export class QueenSetup extends AbstractSetup {
	constructor() {
		super('queen');
		// Role-specific settings
		this.body.pattern = [CARRY, CARRY, MOVE];
	}
}

@profile
export class QueenCreep extends AbstractCreep {
	assignment: Spawn;
	hatchery: IHatchery;

	constructor(creep: Creep) {
		super(creep);
	}

	init() {
		if (this.colony.hatchery) {
			this.hatchery = this.colony.hatchery;
		} else {
			log.error('No hatchery! Suiciding...');
			this.suicide();
		}
	}

	/* Recharge from link if possible, else try to recharge from battery, else complain */
	recharge(): void {
		if (this.hatchery.link && !this.hatchery.link.isEmpty) {
			this.task = new TaskWithdraw(this.hatchery.link);
		} else if (this.hatchery.battery && !this.hatchery.battery.isEmpty) {
			this.task = new TaskWithdraw(this.hatchery.battery);
		} else {
			log.info('Hatchery is out of energy!');
		}
	}

	/* Overwrite the default requestTask method to only receive tasks from the hatchery. */
	requestTask(): void {
		this.hatchery.objectiveGroup.assignTask(this);
	}

	// newTask(): void {
	// 	this.task = null;
	// 	if (this.carry.energy == 0) {
	// 		this.recharge();
	// 	} else {
	// 		this.requestTask();
	// 	}
	// }

	// onRun(): void {
	// 	let suppliers = this.colony.getCreepsByRole('supplier');
	// 	for (let supplier of suppliers) {
	// 		// Delete emergency suppliers in the case a larger one is available
	// 		if (supplier.name != this.name &&
	// 			supplier.getActiveBodyparts(CARRY) > this.getActiveBodyparts(CARRY) &&
	// 			this.getActiveBodyparts(CARRY) == 2) {
	// 			log.info('A larger supplier is available, time to die!');
	// 			this.suicide();
	// 		}
	// 	}
	// }
}
