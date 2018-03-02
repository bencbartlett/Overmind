// Destroyer overlord - spawns attacker/healer pairs for sustained combat

import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../priorities_overlords';
import {DirectiveTargetSiege} from '../../directives/targeting/directive_target_siege';
import {CombatOverlord} from './CombatOverlord';
import {boostResources} from '../../maps/map_resources';
import {DirectiveDestroy} from '../../directives/combat/directive_destroy';
import {CreepSetup} from '../../creepSetup/CreepSetup';

export class AttackerSetup extends CreepSetup {
	static role = 'attacker';

	constructor() {
		super(AttackerSetup.role, {
			pattern  : [TOUGH, ATTACK, ATTACK, MOVE, MOVE, MOVE],
			sizeLimit: Infinity,
		});
	}
}

export class HealerSetup extends CreepSetup {
	static role = 'healer';

	constructor() {
		super(HealerSetup.role, {
			pattern  : [TOUGH, HEAL, HEAL, MOVE, MOVE, MOVE],
			sizeLimit: Infinity,
		});
	}
}


export class DestroyerOverlord extends CombatOverlord {

	attackers: Zerg[];
	healers: Zerg[];
	settings: {
		retreatHitsPercent: number,
		reengageHitsPercent: number,
	};

	constructor(directive: DirectiveDestroy, priority = OverlordPriority.ownedRoom.destroy) {
		super(directive, 'siege', priority);
		this.attackers = this.creeps('attacker');
		this.healers = this.creeps('healer');
		this.boosts.attacker = [
			boostResources.attack[3],
			boostResources.tough[3],
		];
		this.boosts.healer = [
			boostResources.heal[3],
			boostResources.tough[3],
		];
		this.settings = {
			retreatHitsPercent : 0.85,
			reengageHitsPercent: 0.95,
		};
	}

	private findTarget(attacker: Zerg): Creep | Structure | undefined {
		if (this.room) {
			// Prioritize specifically targeted structures first
			let targetingDirectives = DirectiveTargetSiege.find(this.room.flags) as DirectiveTargetSiege[];
			let targetedStructures = _.compact(_.map(targetingDirectives,
													 directive => directive.getTarget())) as Structure[];
			if (targetedStructures.length > 0) {
				return this.findClosestReachable(attacker.pos, targetedStructures);
			} else {
				// Target nearby hostile creeps
				let creepTarget = this.findClosestHostile(attacker, true);
				if (creepTarget) return creepTarget;
				// Target nearby hostile structures
				let structureTarget = this.findClosestPrioritizedStructure(attacker);
				if (structureTarget) return structureTarget;
			}
		}
	}

	private retreatActions(attacker: Zerg, healer: Zerg): void {
		this.pairwiseMove(healer, attacker, this.fallback);
		if (attacker.hits > this.settings.reengageHitsPercent * attacker.hits &&
			healer.hits > this.settings.reengageHitsPercent * healer.hits) {
			attacker.memory.retreating = false;
		}
	}

	private attackActions(attacker: Zerg, healer: Zerg): void {
		let target = this.findTarget(attacker);
		if (target) {
			if (attacker.pos.isNearTo(target)) {
				attacker.attack(target);
			} else {
				this.pairwiseMove(attacker, healer, target);
			}
		}
	}

	private handleSquad(attacker: Zerg): void {
		let healer = this.findPartner(attacker, this.healers);
		if (!healer || healer.spawning || healer.needsBoosts) { // you don't have an active partner
			// Wait near the colony controller if you don't have a healer
			if (attacker.pos.getMultiRoomRangeTo(this.colony.controller.pos) > 5) {
				attacker.travelTo(this.colony.controller);
			} else {
				attacker.park();
			}
		} else { // have an active healer
			// Handle retreating actions
			if (attacker.hits < this.settings.retreatHitsPercent * attacker.hitsMax ||
				healer.hits < this.settings.retreatHitsPercent * healer.hitsMax) {
				attacker.memory.retreating = true;
			}
			if (attacker.memory.retreating) {
				this.retreatActions(attacker, healer);
			}
			// Move to room and then perform attacking actions
			if (!attacker.inSameRoomAs(this)) {
				this.pairwiseMove(attacker, healer, this.pos);
			} else {
				this.attackActions(attacker, healer);
			}
		}
	}

	private handleHealer(healer: Zerg): void {
		if (this.room && this.room.hostiles.length == 0) { // No hostiles in the room
			this.medicActions(healer);
			return;
		}

		let attacker = this.findPartner(healer, this.attackers);
		if (!attacker || attacker.spawning || attacker.needsBoosts) {
			if (healer.hits < healer.hitsMax) {
				healer.heal(healer);
			}
			// Wait near the colony controller if you don't have an attacker
			if (healer.pos.getMultiRoomRangeTo(this.colony.controller.pos) > 10) {
				healer.travelTo(this.colony.controller);
			} else {
				healer.park();
			}
		} else { // you have an attacker partner
			if (attacker.hitsMax - attacker.hits > healer.hitsMax - healer.hits &&
				attacker.hitsMax - attacker.hits > 0) {
				// Attacker needs healing more
				healer.heal(attacker, true);
			} else {
				if (healer.hitsMax - healer.hits > 0) {
					healer.heal(healer);
				} else {
					// Try to heal whatever else is in range
					let target = this.findClosestHurtFriendly(healer);
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
		this.wishlist(amount, new AttackerSetup());
		this.wishlist(amount, new HealerSetup());
	}

	run() {
		for (let attacker of this.attackers) {
			if (attacker.isIdle) {
				if (attacker.needsBoosts) {
					this.handleBoosts(attacker);
				} else {
					this.handleSquad(attacker);
				}
			} else {
				attacker.run();
			}
		}

		for (let healer of this.healers) {
			if (healer.isIdle) {
				if (healer.needsBoosts) {
					this.handleBoosts(healer);
				} else {
					this.handleHealer(healer);
				}
			} else {
				healer.run();
			}
		}
	}
}
