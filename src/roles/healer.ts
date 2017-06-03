// RallyHealer - meant to complement sieger. Sits in adjacent room to fortified target room and heals damaged siegers

import {TaskHeal} from '../tasks/task_heal';
import {AbstractCreep, AbstractSetup} from './Abstract';

export class HealerSetup extends AbstractSetup {
	constructor() {
		super('rallyHealer');
		// Role-specific settings
		this.settings.bodyPattern = [HEAL, MOVE];
		this.settings.bodyPrefix = [TOUGH, TOUGH, TOUGH];
		this.settings.proportionalPrefixSuffix = false;
		this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(HEAL) > 1 &&
												  creep.getActiveBodyparts(MOVE) > 1;
	}
}

export class HealerCreep extends AbstractCreep {

	constructor(creep: Creep) {
		super(creep);
	}

	findTarget(): Creep | void {
		var target;
		var targetPriority = [
			() => this.pos.findClosestByRange(FIND_MY_CREEPS, {filter: (c: Creep) => c.getBodyparts(HEAL) > 0}),
			() => this.pos.findClosestByRange(FIND_MY_CREEPS, {
				filter: (c: Creep) => c.getBodyparts(ATTACK) > 0 || c.getBodyparts(RANGED_ATTACK) > 0,
			}),
			() => this.pos.findClosestByRange(FIND_MY_CREEPS),
		];
		for (let targetThis of targetPriority) {
			target = targetThis() as Creep;
			if (target) {
				return target;
			}
		}
	}

	run() {
		var assignment = Game.flags[this.memory.assignmentRef];
		if (!this.hasValidTask) {
			this.task = null;
			var target = this.findTarget();
			if (target) {
				this.task = new TaskHeal(target);
			}
		}
		if (this.task) {
			return this.task.step();
		}
		if (assignment) {
			if (!this.task) {
				this.travelTo(assignment);
			}
		}
	}
}
