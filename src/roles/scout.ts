// Scout - grants vision in reserved rooms

import {AbstractCreep, AbstractSetup} from './Abstract';

export class ScoutSetup extends AbstractSetup {
	constructor() {
		super('scout');
		// Role-specific settings
		this.settings.bodyPattern = [MOVE];
		this.roleRequirements = (c: Creep) => c.getActiveBodyparts(MOVE) > 1;
	}
}

export class ScoutCreep extends AbstractCreep {
	assignment: Flag;

	constructor(creep: Creep) {
		super(creep);
	}

	run() {
		// if (!this.pos.inRangeTo(this.assignment, 1)) {
			this.travelTo(this.assignment);
		// }
	}
}
