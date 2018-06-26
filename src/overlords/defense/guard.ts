// Guard overlord: spawns guards as needed to deal with an invasion

import {DirectiveGuard} from '../../directives/defense/guard';
import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {CombatOverlord} from '../CombatOverlord';
import {profile} from '../../profiler/decorator';
import {DirectiveHaul} from '../../directives/logistics/haul';
import {CreepSetup} from '../CreepSetup';

const GuardSetup = new CreepSetup('guard', {
	pattern  : [TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, HEAL],
	sizeLimit: 3,
});


@profile
export class GuardOverlord extends CombatOverlord {

	guards: Zerg[];

	static requiredRCL = 3;

	constructor(directive: DirectiveGuard, priority = OverlordPriority.defense.guard) {
		super(directive, 'guard', priority);
		this.guards = this.creeps(GuardSetup.role);
	}

	// private reassignIdleGuards(): void {
	// 	// Find all idle guards
	// 	let idleGuards = _.filter(this.colony.getCreepsByRole('guard'), (guard: Zerg) => !guard.overlord);
	// 	// Reassign them all to this flag
	// 	for (let guard of idleGuards) {
	// 		guard.overlord = this;
	// 	}
	// 	// Refresh the list of guards
	// 	this.guards = this.creeps('guard');
	// }

	private findAttackTarget(guard: Zerg): Creep | Structure | undefined | null {
		let targetingDirectives = DirectiveTargetSiege.find(guard.room.flags) as DirectiveTargetSiege[];
		let targetedStructures = _.compact(_.map(targetingDirectives,
												 directive => directive.getTarget())) as Structure[];
		if (targetedStructures.length > 0) {
			return guard.pos.findClosestByRange(targetedStructures);
		}
		if (guard.room.hostiles.length > 0) {
			let targets = _.filter(guard.room.hostiles, hostile => hostile.pos.rangeToEdge > 0);
			return guard.pos.findClosestByRange(targets);
		}
		if (guard.room.hostileStructures.length > 0) {
			let haulFlags = _.filter(guard.room.flags, flag => DirectiveHaul.filter(flag));
			if (haulFlags.length == 0) {
				return guard.pos.findClosestByRange(guard.room.hostileStructures);
			}
		}
	}

	/* Attack and chase the specified target */
	private combatActions(guard: Zerg, target: Creep | Structure): void {
		// Attack the target if you can, else move to get in range
		this.attackAndChase(guard, target);
		// Heal yourself if it won't interfere with attacking
		this.healSelfIfPossible(guard);
	}

	private handleGuard(guard: Zerg): void {
		if (!guard.inSameRoomAs(this) || guard.pos.isEdge) {
			// Move into the assigned room if there is a guard flag present
			guard.goTo(this.pos);
		} else { // If you're in the assigned room or if there is no assignment, try to attack or heal
			let attackTarget = this.findAttackTarget(guard);
			if (attackTarget) {
				this.combatActions(guard, attackTarget);
			} else {
				this.medicActions(guard);
			}
		}
	}

	init() {
		this.reassignIdleCreeps(GuardSetup.role);
		// TODO: figure out how many guards are needed
		this.wishlist(1, GuardSetup);
	}

	run() {
		for (let guard of this.guards) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (guard.hasValidTask) {
				guard.run();
			} else {
				this.handleGuard(guard);
			}
		}
	}
}
