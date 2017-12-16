// Guard: dumb bot that goes to a flag and then attacks everything hostile in the room, returning to flag
// Best used only against low level npc invaders; sized to defend outposts

import {AbstractCreep, AbstractSetup} from './Abstract';
import {profile} from '../lib/Profiler';

@profile
export class GuardSetup extends AbstractSetup {
	constructor() {
		super('guard');
		// Role-specific settings
		this.body.pattern = [TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, HEAL];
		this.body.ordered = true;
	}
}

@profile
export class GuardCreep extends AbstractCreep {

	assignment: Flag | null;
	task: null; // Guard creeps don't use tasks

	constructor(creep: Creep) {
		super(creep);
	}

	private findAttackTarget(): Creep | Structure | void {
		// Prioritize healers?
		// let enemyHealers = _.filter(this.room.hostiles, creep => creep.getActiveBodyparts(HEAL) > 0);
		// if (enemyHealers.length > 0) {
		// 	return this.pos.findClosestByRange(enemyHealers);
		// }
		if (this.room.hostiles.length > 0) {
			return this.pos.findClosestByRange(this.room.hostiles);
		}
		if (this.room.hostileStructures.length > 0) {
			return this.pos.findClosestByRange(this.room.hostileStructures);
		}
	}

	private findHealTarget(): Creep | void {
		this.pos.findClosestByRange(_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax));
	}

	/* Attack and chase the specified target */
	private attackActions(attackTarget: Creep | Structure): void {
		if (this.pos.isNearTo(attackTarget)) {
			// Attack if you can, otherwise heal yourself
			if (this.attack(attackTarget) != OK) {
				this.heal(this);
			}
			// Move in the direction of the creep to prevent it from running away
			this.move(this.pos.getDirectionTo(attackTarget));
		} else {
			this.travelTo(attackTarget, {movingTarget: true});
		}
	}

	/* Move to and heal/rangedHeal the specified target */
	private healActions(healTarget: Creep): void {
		// Heal or ranged heal the nearest damaged creep
		let range = this.pos.getRangeTo(healTarget);
		if (range > 1) {
			this.travelTo(healTarget, {movingTarget: true});
		}
		if (range === 1) {
			this.heal(healTarget);
		}
		else if (range <= 3) {
			this.rangedHeal(healTarget);
		}
	}

	run() {
		if (this.assignment && this.pos.roomName != this.assignment.pos.roomName) {
			// Move into the assigned room if there is a guard flag present
			this.travelTo(this.assignment.pos);
		} else { // If you're in the assigned room or if there is no assignment, try to attack or heal
			let attackTarget = this.findAttackTarget();
			let healTarget = this.findHealTarget();
			if (attackTarget) {
				this.attackActions(attackTarget);
			} else if (healTarget) {
				this.healActions(healTarget);
			}
			// else {
			// 	// If there's no more attackTargets, delete your assigned flag and remove from memory
			// 	this.assignment.remove();
			// 	this.assignment = null;
			// }
		}
	}
}

