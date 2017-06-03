// Guard: dumb bot that goes to a flag and then attacks everything hostile in the room, returning to flag
// Best used only against low level npc invaders; sized to defend outposts

import {TaskAttack} from '../tasks/task_attack';
import {AbstractCreep, AbstractSetup} from './Abstract';


export class GuardSetup extends AbstractSetup {
	constructor() {
		super('guard');
		// Role-specific settings
		this.settings.bodyPattern = [MOVE, ATTACK, RANGED_ATTACK];
		this.settings.orderedBodyPattern = true;
		this.settings.notifyOnNoTask = false;
		this.roleRequirements = (c: Creep) => c.getActiveBodyparts(ATTACK) > 1 &&
											  c.getActiveBodyparts(RANGED_ATTACK) > 1 &&
											  c.getActiveBodyparts(MOVE) > 1;
	}
}


export class GuardCreep extends AbstractCreep {

	assignment: Flag;

	constructor(creep: Creep) {
		super(creep);
	}

	findTarget(): Creep | Structure | void {
		var target;
		var targetPriority = [
			() => this.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
				filter: (c: Creep) => c.getActiveBodyparts(HEAL) > 0,
			}),
			() => this.pos.findClosestByRange(FIND_HOSTILE_CREEPS),
			() => this.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
			() => this.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits}),
		];
		for (let targetThis of targetPriority) {
			target = targetThis() as Creep | Structure;
			if (target) {
				return target;
			}
		}
	}

	newTask() {
		this.task = null;
		// if not in the assigned room, move there; executed in bottom of run function
		if (this.assignment && !this.creep.inSameRoomAs(this.assignment)) {
			return null;
		}
		// first try to find anything you should attack
		var target = this.findTarget();
		if (target) {
			this.task = new TaskAttack(target);
		} else {
			// if no hostiles and you can repair stuff, do so
			if (this.getActiveBodyparts(CARRY) > 0 && this.getActiveBodyparts(WORK) > 0) {
				if (this.carry.energy == 0) {
					return this.recharge();
				} else {
					return this.requestTask(); // get applicable tasks from room brain
				}
			}
		}
	}

	run() {
		if (!this.hasValidTask || (this.room.hostiles.length > 0 && this.task && this.task.name != 'attack')) {
			this.newTask();
		}
		if (this.task) {
			return this.task.step();
		}
		if (this.assignment) {
			if (!this.task) {
				this.travelTo(this.assignment);
			}
		}
	}
}
