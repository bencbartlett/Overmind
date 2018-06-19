// archer overlord - spawns defender/healer pairs for sustained combat

import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {CombatOverlord} from '../CombatOverlord';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';
import {CombatIntel} from '../../intel/combatIntel';
import {GuardPairOverlord} from './guardPair';
import {CreepSetup} from '../CreepSetup';
import {minBy} from '../../utilities/utils';

const ZerglingSetup = new CreepSetup('zergling', {
	pattern  : [ATTACK, MOVE],
	sizeLimit: Infinity,
});

const ArmoredZerglingSetup = new CreepSetup('zergling', {
	pattern  : [TOUGH, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE],
	sizeLimit: Infinity,
});

@profile
export class MeleeDefenseOverlord extends CombatOverlord {

	defenders: Zerg[];
	private defendPositions: RoomPosition[];
	room: Room;

	static settings = {
		retreatHitsPercent : 0.50,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense, boosted = false, priority = OverlordPriority.defense.meleeDefense) {
		super(directive, 'meleeDefense', priority);
		this.defenders = this.creeps(ZerglingSetup.role);
		if (boosted) {
			this.boosts[ZerglingSetup.role] = [
				boostResources.tough[3],
				boostResources.attack[3],
			];
		}
		let rampartPositions = _.map(_.filter(this.colony.room.barriers, s => s.structureType == STRUCTURE_RAMPART),
									 barrier => barrier.pos);
		this.defendPositions = _.filter(rampartPositions,
										pos => pos.findInRange(this.colony.room.hostiles, 1).length > 1);
	}

	private retreatActions(defender: Zerg): void {
		if (defender.hits > MeleeDefenseOverlord.settings.reengageHitsPercent * defender.hits) {
			defender.memory.retreating = false;
		}
		// Find a safe position and retreat
		let retreatRampart = defender.pos.findClosestByRange(_.filter(this.room.ramparts,
																	  rampart => rampart.pos.isPassible()));
		defender.goTo(retreatRampart);
	}

	private handleDefender(defender: Zerg): void {
		// // Move to a defensible position
		// let isStandingInDefensePos = _.any(this.defendPositions, pos => pos.isEqualTo(defender.pos));
		// if (!isStandingInDefensePos) {
		// 	let availablePositions = _.filter(this.defendPositions, pos => pos.lookFor(LOOK_CREEPS).length == 0);
		// 	let target = defender.pos.findClosestByRange(availablePositions);
		// 	if (target) {
		// 		let enemyPositions = _.map(this.room.hostiles, hostile => hostile.pos);
		// 		defender.goTo(target, {obstacles: enemyPositions, movingTarget: true});
		// 	}
		// }
		// // Attack something
		// let target = this.findClosestHostile(defender, false, false);
		// if (target && defender.pos.isNearTo(target)) {
		// 	defender.attack(target);
		// }

		// Get a target
		let adjacentHostiles = _.filter(this.room.hostiles, creep => defender.pos.getRangeTo(creep.pos) == 1);
		let target: Creep | undefined;
		if (adjacentHostiles.length > 1) {
			target = minBy(adjacentHostiles, (hostile: Creep) => CombatIntel.maxHostileHealingTo(hostile));
		} else {
			target = this.findClosestHostile(defender, false, false);
		}
		// Attack something
		if (target && defender.pos.isNearTo(target)) {
			defender.attack(target);
		}
		// Move to a defensible position if there is one; else, engage target directly
		let isStandingInDefensePos = _.any(this.defendPositions, pos => pos.isEqualTo(defender.pos));
		if (!isStandingInDefensePos) {
			let availablePositions = _.filter(this.defendPositions, pos => pos.lookFor(LOOK_CREEPS).length == 0);
			let moveToDefensePos = defender.pos.findClosestByRange(availablePositions);
			if (moveToDefensePos) {
				let enemyPositions = _.map(this.room.hostiles, hostile => hostile.pos);
				defender.goTo(moveToDefensePos, {obstacles: enemyPositions, movingTarget: true});
			} else {
				// Activate retreat condition if necessary
				if (defender.hits < GuardPairOverlord.settings.retreatHitsPercent * defender.hitsMax) {
					defender.memory.retreating = true;
				}
				// Either retreat to healing position or engage target
				if (defender.memory.retreating) {
					this.retreatActions(defender); // Retreat to fallback position
				} else {
					if (target) {
						defender.goTo(target);
					}
				}
			}
		}
	}

	init() {
		this.reassignIdleCreeps(ZerglingSetup.role);
		let healPotential = CombatIntel.maxHealingByCreeps(this.room.hostiles);
		let zerglingDamage = ATTACK_POWER * ZerglingSetup.getBodyPotential(ATTACK, this.colony);
		let towerDamage = this.room.hostiles[0] ? CombatIntel.towerDamageAtPos(this.room.hostiles[0].pos) || 0 : 0;
		let worstDamageMultiplier = _.min(_.map(this.room.hostiles, creep => CombatIntel.damageTakenMultiplier(creep)));
		let boosts = this.boosts[ZerglingSetup.role];
		if (boosts && boosts.includes(boostResources.attack[3])) { // TODO: add boost damage computation function to Overlord
			zerglingDamage *= 4;
		}
		// Match the hostile damage times some multiplier
		let amount = Math.ceil(1.5 * healPotential / (worstDamageMultiplier * (zerglingDamage + towerDamage)));
		if (this.colony.level >= 3) {
			this.wishlist(amount, ArmoredZerglingSetup);
		} else {
			this.wishlist(amount, ZerglingSetup);
		}
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
