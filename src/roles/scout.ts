// Scout - grants vision in reserved rooms

import {AbstractCreep, AbstractSetup} from './Abstract';
import {profileClass} from '../profiling';

export class ScoutSetup extends AbstractSetup {
	constructor() {
		super('scout');
		// Role-specific settings
		this.body.pattern = [MOVE];
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

profileClass(ScoutSetup);
profileClass(ScoutCreep);
