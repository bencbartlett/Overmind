// archer overlord - spawns defender/healer pairs for sustained combat

import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {CombatOverlord} from '../CombatOverlord';
import {CreepSetup} from '../CreepSetup';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';
import {CombatIntel} from '../../intel/combatIntel';

const HydraliskSetup = new CreepSetup('hydralisk', {
	pattern  : [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, MOVE, MOVE],
	sizeLimit: Infinity,
});

@profile
export class RangedDefenseOverlord extends CombatOverlord {

	defenders: Zerg[];
	private avoid: RoomPosition[];
	private retreatPos: RoomPosition;
	room: Room;
	settings: {
		retreatHitsPercent: number,
		reengageHitsPercent: number,
	};

	constructor(directive: DirectiveInvasionDefense, boosted = false,
				priority                                     = OverlordPriority.defense.rangedDefense) {
		super(directive, 'rangedDefense', priority);
		this.defenders = this.creeps(HydraliskSetup.role);
		if (boosted) {
			this.boosts[HydraliskSetup.role] = [
				boostResources.ranged_attack[3],
				boostResources.heal[3],
			];
		}
		this.retreatPos = this.colony.controller.pos;
		this.settings = {
			retreatHitsPercent : 0.85,
			reengageHitsPercent: 0.95,
		};
		this.avoid = CombatIntel.getPositionsNearEnemies(this.room.dangerousHostiles, 2);

	}

	private findTarget(archer: Zerg): Creep | Structure | undefined {
		if (this.room) {
			// Prioritize specifically targeted structures first
			let targetingDirectives = DirectiveTargetSiege.find(this.room.flags) as DirectiveTargetSiege[];
			let targetedStructures = _.compact(_.map(targetingDirectives,
													 directive => directive.getTarget())) as Structure[];
			if (targetedStructures.length > 0) {
				return this.findClosestReachable(archer.pos, targetedStructures);
			} else {
				// Target nearby hostile creeps
				let creepTarget = this.findClosestHostile(archer, false);
				if (creepTarget) return creepTarget;
				// Target nearby hostile structures
				let structureTarget = this.findClosestPrioritizedStructure(archer);
				if (structureTarget) return structureTarget;
			}
		}
	}

	private retreatActions(archer: Zerg): void {
		archer.travelTo(this.fallback, {obstacles: this.avoid, movingTarget: true});
		if (archer.hits > this.settings.reengageHitsPercent * archer.hits) {
			archer.memory.retreating = false;
		}
	}

	private attackActions(attacker: Zerg): void {
		let target = this.findTarget(attacker);
		if (target) {
			let range = attacker.pos.getRangeTo(target);
			if (range <= 3) {
				attacker.rangedAttack(target);
			}
			if (range < 3) { // retreat to controller if too close
				attacker.travelTo(this.colony.controller, {obstacles: this.avoid, movingTarget: true});
			} else if (range > 3) { // approach the target if too far
				if (target.pos.rangeToEdge >= 2) {
					attacker.travelTo(target, _.merge(this.moveOpts, {
						range       : 3,
						obstacles   : this.avoid,
						movingTarget: true
					}));
				}
			}
		}
	}

	private healActions(defender: Zerg): void {
		if (this.room && this.room.hostiles.length == 0) { // No hostiles in the room
			this.medicActions(defender);
			return;
		}

		if (defender.hits < defender.hitsMax) {
			defender.heal(defender);
		} else {
			// Try to heal whatever else is in range
			let target = defender.pos.findClosestByRange(this.defenders);
			if (target) {
				defender.heal(target, false);
				defender.travelTo(target, {obstacles: this.avoid, movingTarget: true});
			}
		}
	}


	private handleDefender(defender: Zerg): void {
		// Handle retreating actions
		if (defender.hits < this.settings.retreatHitsPercent * defender.hitsMax) {
			defender.memory.retreating = true;
		}
		if (defender.memory.retreating) {
			this.retreatActions(defender);
		}
		// Move to room and then perform attacking actions
		if (!defender.inSameRoomAs(this)) {
			defender.travelTo(this.pos);
		} else {
			this.attackActions(defender);
			this.healActions(defender);
		}
	}

	init() {
		this.reassignIdleCreeps(HydraliskSetup.role);
		let damagePotential = CombatIntel.maxDamageByCreeps(this.room.dangerousHostiles);
		let hydraliskDamage = RANGED_ATTACK_POWER * HydraliskSetup.getBodyPotential(RANGED_ATTACK, this.colony);
		let boosts = this.boosts[HydraliskSetup.role];
		if (boosts && boosts.includes(boostResources.ranged_attack[3])) { // TODO: add boost damage computation function to Overlord
			hydraliskDamage *= 4;
		}
		// Match the hostile damage times some multiplier
		let amount = Math.ceil(0.5 * damagePotential / hydraliskDamage);
		this.wishlist(amount, HydraliskSetup);
		this.requestBoosts();
	}

	run() {
		for (let defender of this.defenders) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (defender.hasValidTask) {
				defender.run();
			} else {
				if (defender.needsBoosts) {
					this.handleBoosting(defender);
				} else {
					this.handleDefender(defender);
				}
			}
		}
		if (this.room.hostiles.length == 0) {
			this.parkCreepsIfIdle(this.defenders);
		}
	}
}
