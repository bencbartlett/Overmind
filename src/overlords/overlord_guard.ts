// Guard overlord: spawns guards as needed to deal with an invasion

import {Overlord} from './Overlord';
import {GuardSetup} from '../creepSetup/defaultSetups';
import {DirectiveGuard} from '../directives/directive_guard';
import {Zerg} from '../Zerg';
import {OverlordPriority} from './priorities_overlords';

export class GuardOverlord extends Overlord {

	guards: Zerg[];

	constructor(directive: DirectiveGuard, priority = OverlordPriority.defense.guard) {
		super(directive, 'guard', priority);
		this.guards = this.creeps('guard');
	}

	private reassignIdleGuards(): void {
		// Find all idle guards
		let idleGuards = _.filter(this.colony.getCreepsByRole('guard'), (guard: Zerg) => !guard.overlord);
		// Reassign them all to this flag
		for (let guard of idleGuards) {
			guard.overlord = this;
		}
		// Refresh the list of guards
		this.guards = this.creeps('guard');
	}

	private findAttackTarget(guard: Zerg): Creep | Structure | void {
		if (guard.room.hostiles.length > 0) {
			return guard.pos.findClosestByRange(guard.room.hostiles);
		}
		if (guard.room.hostileStructures.length > 0) {
			return guard.pos.findClosestByRange(guard.room.hostileStructures);
		}
	}

	private findHealTarget(guard: Zerg): Creep | undefined {
		return guard.pos.findClosestByRange(_.filter(guard.room.creeps, creep => creep.hits < creep.hitsMax));
	}

	/* Attack and chase the specified target */
	private combatActions(guard: Zerg, target: Creep | Structure): void {

		let hasAttacked = false;
		// Attack the target if you can, else move to get in range
		if (guard.pos.isNearTo(target)) {
			// Attack if you can, otherwise heal yourself
			if (guard.attack(target) == OK) {
				hasAttacked = true;
			}
			// Move in the direction of the creep to prevent it from running away
			guard.move(guard.pos.getDirectionTo(target));
		} else {
			guard.travelTo(target, {movingTarget: true});
		}

		// Heal yourself if it won't interfere with attacking
		if (!hasAttacked && guard.hits < guard.hitsMax) {
			guard.heal(guard);
		}
	}

	/* Move to and heal/rangedHeal the specified target */
	private medicActions(guard: Zerg, target: Creep): void {

		// Approach the target
		let range = guard.pos.getRangeTo(target);
		if (range > 1) {
			guard.travelTo(target, {movingTarget: true});
		}

		// Heal or ranged-heal the garget
		if (range <= 1) {
			guard.heal(target);
		} else if (range <= 3) {
			guard.rangedHeal(target);
		}
	}

	private handleGuard(guard: Zerg): void {

		if (guard.pos.roomName != this.pos.roomName) { // TODO: make edge-safe
			// Move into the assigned room if there is a guard flag present
			guard.travelTo(this.pos);
		} else { // If you're in the assigned room or if there is no assignment, try to attack or heal
			let attackTarget = this.findAttackTarget(guard);
			let healTarget = this.findHealTarget(guard);
			if (attackTarget) {
				this.combatActions(guard, attackTarget);
			} else if (healTarget) {
				this.medicActions(guard, healTarget);
			}
		}
	}

	spawn() {
		// TODO: figure out how many guards are needed
		this.wishlist(1, new GuardSetup());
	}

	init() {
		this.reassignIdleGuards();
		this.spawn();
	}

	run() {
		for (let guard of this.guards) {
			this.handleGuard(guard);
		}
	}
}
