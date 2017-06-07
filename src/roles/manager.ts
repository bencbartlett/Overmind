// Linker - transfers energy from link to storage

import {AbstractCreep, AbstractSetup} from './Abstract';

export class ManagerSetup extends AbstractSetup {
	constructor() {
		super('manager');
		// Role-specific settings
		this.settings.bodyPattern = [CARRY, CARRY, MOVE];
		this.settings.consoleQuiet = true;
		this.settings.sayQuiet = true;
		this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
												  creep.getActiveBodyparts(CARRY) > 1;
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
		// Managers are controlled by the hatchery and don't have internal logic
		this.executeTask();
	}
}
