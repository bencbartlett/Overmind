// Scout - grants vision in reserved rooms

import {AbstractCreep, AbstractSetup} from './Abstract';
import {profile} from '../lib/Profiler';

@profile
export class ScoutSetup extends AbstractSetup {
	constructor() {
		super('scout');
		// Role-specific settings
		this.body.pattern = [MOVE];
	}
}

@profile
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
