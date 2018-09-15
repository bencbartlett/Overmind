// Guard overlord: spawns guards as needed to deal with standard NPC invasions

import {DirectiveGuard} from '../../directives/defense/guard';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {profile} from '../../profiler/decorator';
import {DirectiveHaul} from '../../directives/resource/haul';
import {Overlord} from '../Overlord';
import {CombatZerg} from '../../zerg/CombatZerg';
import {RoomIntel} from '../../intel/RoomIntel';
import {CombatSetups, Roles} from '../../creepSetups/setups';

@profile
export class DefenseNPCOverlord extends Overlord {

	guards: CombatZerg[];

	static requiredRCL = 3;

	constructor(directive: DirectiveGuard, priority = OverlordPriority.outpostDefense.guard) {
		super(directive, 'guard', priority);
		this.guards = this.combatZerg(Roles.guardMelee);
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

	private findAttackTarget(guard: CombatZerg): Creep | Structure | undefined | null {
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
	private combatActions(guard: CombatZerg, target: Creep | Structure): void {
		// Attack the target if you can, else move to get in range
		guard.attackAndChase(target);
		// Heal yourself if it won't interfere with attacking
		guard.healSelfIfPossible();
	}

	private handleGuard(guard: CombatZerg): void {
		if (!guard.inSameRoomAs(this) || guard.pos.isEdge) {
			// Move into the assigned room if there is a guard flag present
			guard.goToRoom(this.pos.roomName);
		} else { // If you're in the assigned room or if there is no assignment, try to attack or heal
			let attackTarget = this.findAttackTarget(guard);
			if (attackTarget) {
				this.combatActions(guard, attackTarget);
			} else {
				guard.doMedicActions(this.pos.roomName);
			}
		}
	}

	init() {
		let amount = this.room && (this.room.invaders.length > 0 || RoomIntel.isInvasionLikely(this.room)) ? 1 : 0;
		this.wishlist(amount, CombatSetups.guards.melee, {reassignIdle: true});
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
