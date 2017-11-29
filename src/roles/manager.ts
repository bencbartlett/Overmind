// Linker - transfers energy from link to storage

import {AbstractCreep, AbstractSetup} from './Abstract';
import {profileClass} from '../profiling';

export class ManagerSetup extends AbstractSetup {
	constructor() {
		super('manager');
		// Role-specific settings
		this.body.pattern = [CARRY, CARRY, MOVE];
	}
}


export class ManagerCreep extends AbstractCreep {
	assignment: Storage;
	commandCenter: ICommandCenter;

	constructor(creep: Creep) {
		super(creep);
		this.commandCenter = this.colony.commandCenter!;
	}

	run() {
		// Managers are controlled by the command center and don't have internal logic
		this.executeTask();
	}
}

profileClass(ManagerSetup);
profileClass(ManagerCreep);
