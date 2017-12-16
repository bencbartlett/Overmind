// Miner - stationary harvester for container mining. Fills containers and sits in place.

import {TaskDeposit} from '../tasks/task_deposit';
import {TaskHarvest} from '../tasks/task_harvest';
import {AbstractCreep, AbstractSetup} from './Abstract';
import {profile} from '../lib/Profiler';

@profile
export class MinerSetup extends AbstractSetup {
	constructor() {
		super('miner');
		// Role-specific settings
		this.body.pattern = [WORK, WORK, CARRY, MOVE];
	}
}

@profile
export class MinerCreep extends AbstractCreep {
	assignment: Source;
	miningSite: IMiningSite;

	constructor(creep: Creep) {
		super(creep);
	}

	init() {
		if (!this.assignment) {
			return;
		}
		this.miningSite = this.colony.miningSites[this.assignment.ref];
	}

	newTask() {
		// Ensure you are in the assigned room
		if (this.inAssignedRoom && !this.pos.isEdge) {
			// Are you out of energy?
			if (this.carry.energy == 0) {
				this.task = new TaskHarvest(this.assignment);
			} else if (this.miningSite && this.miningSite.output) { // output construction sites handled by miningSite
				this.task = new TaskDeposit(this.miningSite.output);
			}
		} else if (this.assignmentPos) {
			this.travelTo(this.assignmentPos);
		}
	}

	onRun() {
		if (this.getActiveBodyparts(WORK) < 0.75 * this.getBodyparts(WORK)) {
			this.suicide(); // kill off miners that might have gotten damaged so they don't sit and try to mine
		}
	}
}
