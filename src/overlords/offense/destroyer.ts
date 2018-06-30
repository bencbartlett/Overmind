// Destroyer overlord - spawns attacker/healer pairs for sustained combat

import {OverlordPriority} from '../../priorities/priorities_overlords';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {DirectiveDestroy} from '../../directives/offense/destroy';
import {CreepSetup} from '../CreepSetup';
import {profile} from '../../profiler/decorator';
import {Movement} from '../../movement/Movement';
import {Overlord} from '../Overlord';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatTargeting} from '../../targeting/CombatTargeting';
import {CombatIntel} from '../../intel/combatIntel';

const AttackerSetup = new CreepSetup('attacker', {
	pattern  : [TOUGH, ATTACK, ATTACK, MOVE, MOVE, MOVE],
	sizeLimit: Infinity,
	ordered  : true
});

const HealerSetup = new CreepSetup('healer', {
	pattern  : [TOUGH, HEAL, HEAL, MOVE, MOVE, MOVE],
	sizeLimit: Infinity,
	ordered  : true
});

@profile
export class DestroyerOverlord extends Overlord {

	directive: DirectiveDestroy;
	attackers: CombatZerg[];
	healers: CombatZerg[];

	static settings = {
		retreatHitsPercent : 0.75,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveDestroy, priority = OverlordPriority.offense.destroy) {
		super(directive, 'destroy', priority);
		this.directive = directive;
		this.attackers = _.map(this.creeps(AttackerSetup.role), creep => new CombatZerg(creep));
		this.healers = _.map(this.creeps(HealerSetup.role), creep => new CombatZerg(creep));
		// Comment out boost lines if you don't want to spawn boosted attackers/healers
		// this.boosts.attacker = [
		// 	boostResources.attack[3],
		// 	boostResources.tough[3],
		// ];
		// this.boosts.healer = [
		// 	boostResources.heal[3],
		// 	boostResources.tough[3],
		// ];
	}

	private findTarget(attacker: CombatZerg): Creep | Structure | undefined {
		if (this.room) {
			// Prioritize specifically targeted structures first
			let targetingDirectives = DirectiveTargetSiege.find(this.room.flags) as DirectiveTargetSiege[];
			let targetedStructures = _.compact(_.map(targetingDirectives,
													 directive => directive.getTarget())) as Structure[];
			if (targetedStructures.length > 0) {
				return CombatTargeting.findClosestReachable(attacker.pos, targetedStructures);
			} else {
				// Target nearby hostile creeps
				let creepTarget = CombatTargeting.findClosestHostile(attacker, true);
				if (creepTarget) return creepTarget;
				// Target nearby hostile structures
				let structureTarget = CombatTargeting.findClosestPrioritizedStructure(attacker);
				if (structureTarget) return structureTarget;
			}
		}
	}

	private retreatActions(attacker: CombatZerg, healer: CombatZerg): void {
		if (attacker.hits > DestroyerOverlord.settings.reengageHitsPercent * attacker.hits &&
			healer.hits > DestroyerOverlord.settings.reengageHitsPercent * healer.hits) {
			attacker.memory.retreating = false;
		}
		// Healer leads retreat to fallback position
		Movement.pairwiseMove(healer, attacker, CombatIntel.getFallbackFrom(this.directive.pos));
	}

	private attackActions(attacker: CombatZerg, healer: CombatZerg): void {
		let target = this.findTarget(attacker);
		if (target) {
			if (attacker.pos.isNearTo(target)) {
				attacker.attack(target);
			} else {
				Movement.pairwiseMove(attacker, healer, target);
			}
		}
	}

	private handleSquad(attacker: CombatZerg): void {
		let healer = attacker.findPartner(this.healers);
		// Case 1: you don't have an active healer
		if (!healer || healer.spawning || healer.needsBoosts) {
			// Wait near the colony controller if you don't have a healer
			if (attacker.pos.getMultiRoomRangeTo(this.colony.controller.pos) > 5) {
				attacker.goTo(this.colony.controller);
			} else {
				attacker.park();
			}
		}
		// Case 2: you have an active healer
		else {
			// Activate retreat condition if necessary
			if (attacker.hits < DestroyerOverlord.settings.retreatHitsPercent * attacker.hitsMax ||
				healer.hits < DestroyerOverlord.settings.retreatHitsPercent * healer.hitsMax) {
				attacker.memory.retreating = true;
			}
			if (attacker.memory.retreating) {
				// Retreat to fallback position
				this.retreatActions(attacker, healer);
			} else {
				// Move to room and then perform attacking actions
				if (!attacker.inSameRoomAs(this)) {
					Movement.pairwiseMove(attacker, healer, this.pos);
				} else {
					this.attackActions(attacker, healer);
				}
			}
		}
	}

	private handleHealer(healer: CombatZerg): void {
		// If there are no hostiles in the designated room, run medic actions
		if (this.room && this.room.hostiles.length == 0) {
			healer.doMedicActions();
			return;
		}
		let attacker = healer.findPartner(this.attackers);
		// Case 1: you don't have an attacker partner
		if (!attacker || attacker.spawning || attacker.needsBoosts) {
			if (healer.hits < healer.hitsMax) {
				healer.heal(healer);
			}
			// Wait near the colony controller if you don't have an attacker
			if (healer.pos.getMultiRoomRangeTo(this.colony.controller.pos) > 10) {
				healer.goTo(this.colony.controller);
			} else {
				healer.park();
			}
		}
		// Case 2: you have an attacker partner
		else {
			if (attacker.hitsMax - attacker.hits > healer.hitsMax - healer.hits &&
				attacker.hitsMax - attacker.hits > 0) {
				// Attacker needs healing more
				healer.heal(attacker, true);
			} else {
				if (healer.hitsMax - healer.hits > 0) {
					healer.heal(healer);
				} else {
					// Try to heal whatever else is in range
					let target = CombatTargeting.findClosestHurtFriendly(healer);
					if (target) healer.heal(target, true);
				}
			}
		}
	}

	init() {
		let amount;
		if (this.directive.memory.amount) {
			amount = this.directive.memory.amount;
		} else {
			amount = 1;
		}
		let attackerPriority = this.attackers.length < this.healers.length ? this.priority - 0.1 : this.priority + 0.1;
		let healerPriority = this.healers.length < this.attackers.length ? this.priority - 0.1 : this.priority + 0.1;
		this.wishlist(amount, AttackerSetup);
		this.wishlist(amount, HealerSetup);
		this.requestBoosts(this.attackers);
		this.requestBoosts(this.healers);
	}

	run() {
		for (let attacker of this.attackers) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (attacker.hasValidTask) {
				attacker.run();
			} else {
				if (attacker.needsBoosts) {
					this.handleBoosting(attacker);
				} else {
					this.handleSquad(attacker);
				}
			}
		}

		for (let healer of this.healers) {
			if (healer.hasValidTask) {
				healer.run();
			} else {
				if (healer.needsBoosts) {
					this.handleBoosting(healer);
				} else {
					this.handleHealer(healer);
				}
			}
		}
	}
}
