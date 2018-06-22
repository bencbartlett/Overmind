// // archer overlord - spawns defender/healer pairs for sustained combat
//
// import {Zerg} from '../../Zerg';
// import {OverlordPriority} from '../priorities_overlords';
// import {CombatOverlord} from '../CombatOverlord';
// import {boostResources} from '../../resources/map_resources';
// import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
// import {profile} from '../../profiler/decorator';
// import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
// import minBy from 'lodash.minby';
// import {CombatIntel} from '../../intel/combatIntel';
// import {GuardPairOverlord} from './guardPair';
// import {CreepSetup} from '../CreepSetup';
//
// const HealerSetup = new CreepSetup('healer', {
// 	pattern  : [HEAL, MOVE],
// 	sizeLimit: Infinity,
// });
//
// @profile
// export class HealerDefenseOverlord extends CombatOverlord {
//
// 	defenders: Zerg[];
// 	private defendPositions: RoomPosition[];
// 	room: Room;
//
// 	static settings = {
// 		retreatHitsPercent : 0.50,
// 		reengageHitsPercent: 0.95,
// 	};
//
// 	constructor(directive: DirectiveInvasionDefense, boosted = false, priority = OverlordPriority.defense.meleeDefense) {
// 		super(directive, 'healer', priority);
// 		this.defenders = this.creeps(HealerSetup.role);
// 		if (boosted) {
// 			this.boosts.defender = [
// 				boostResources.attack[3],
// 			];
// 		}
// 		let rampartPositions = _.map(_.filter(this.colony.room.barriers, s => s.structureType == STRUCTURE_RAMPART),
// 									 barrier => barrier.pos);
// 		this.defendPositions = _.filter(rampartPositions,
// 										pos => pos.findInRange(this.colony.room.hostiles, 1).length > 1);
// 	}
//
// 	private findTarget(attacker: Zerg): Creep | Structure | undefined {
// 		if (this.room) {
// 			// Prioritize specifically targeted structures first
// 			let targetingDirectives = DirectiveTargetSiege.find(this.room.flags) as DirectiveTargetSiege[];
// 			let targetedStructures = _.compact(_.map(targetingDirectives,
// 													 directive => directive.getTarget())) as Structure[];
// 			if (targetedStructures.length > 0) {
// 				return this.findClosestReachable(attacker.pos, targetedStructures);
// 			} else {
// 				// Target nearby hostile creeps
// 				let creepTarget = this.findClosestHostile(attacker, true);
// 				if (creepTarget) return creepTarget;
// 				// Target nearby hostile structures
// 				let structureTarget = this.findClosestPrioritizedStructure(attacker);
// 				if (structureTarget) return structureTarget;
// 			}
// 		}
// 	}
//
// 	private retreatActions(defender: Zerg): void {
// 		if (defender.hits > HealerDefenseOverlord.settings.reengageHitsPercent * defender.hits) {
// 			defender.memory.retreating = false;
// 		}
// 		// Find a safe position and retreat
// 		let retreatRampart = defender.pos.findClosestByRange(_.filter(this.room.ramparts,
// 																	  rampart => rampart.pos.isWalkable()));
// 		defender.goTo(retreatRampart);
// 	}
//
// 	private handleDefender(defender: Zerg): void {
// 		// // Move to a defensible position
// 		// let isStandingInDefensePos = _.any(this.defendPositions, pos => pos.isEqualTo(defender.pos));
// 		// if (!isStandingInDefensePos) {
// 		// 	let availablePositions = _.filter(this.defendPositions, pos => pos.lookFor(LOOK_CREEPS).length == 0);
// 		// 	let target = defender.pos.findClosestByRange(availablePositions);
// 		// 	if (target) {
// 		// 		let enemyPositions = _.map(this.room.hostiles, hostile => hostile.pos);
// 		// 		defender.goTo(target, {obstacles: enemyPositions, movingTarget: true});
// 		// 	}
// 		// }
// 		// // Attack something
// 		// let target = this.findClosestHostile(defender, false, false);
// 		// if (target && defender.pos.isNearTo(target)) {
// 		// 	defender.attack(target);
// 		// }
//
// 		// Get a target
// 		let adjacentHostiles = _.filter(this.room.hostiles, creep => defender.pos.getRangeTo(creep.pos) == 1);
// 		let target: Creep | undefined;
// 		if (adjacentHostiles.length > 1) {
// 			target = minBy(adjacentHostiles, (hostile: Creep) => CombatIntel.hostileHealPotential(hostile));
// 		} else {
// 			target = this.findClosestHostile(defender, false, false);
// 		}
// 		// Attack something
// 		if (target && defender.pos.isNearTo(target)) {
// 			defender.attack(target);
// 		}
// 		// Move to a defensible position if there is one; else, engage target directly
// 		let isStandingInDefensePos = _.any(this.defendPositions, pos => pos.isEqualTo(defender.pos));
// 		if (!isStandingInDefensePos) {
// 			let availablePositions = _.filter(this.defendPositions, pos => pos.lookFor(LOOK_CREEPS).length == 0);
// 			let moveToDefensePos = defender.pos.findClosestByRange(availablePositions);
// 			if (moveToDefensePos) {
// 				let enemyPositions = _.map(this.room.hostiles, hostile => hostile.pos);
// 				defender.goTo(moveToDefensePos, {obstacles: enemyPositions, movingTarget: true});
// 			} else {
// 				// Activate retreat condition if necessary
// 				if (defender.hits < GuardPairOverlord.settings.retreatHitsPercent * defender.hitsMax) {
// 					defender.memory.retreating = true;
// 				}
// 				// Either retreat to healing position or engage target
// 				if (defender.memory.retreating) {
// 					this.retreatActions(defender); // Retreat to fallback position
// 				} else {
// 					if (target) {
// 						defender.goTo(target);
// 					}
// 				}
// 			}
// 		}
// 	}
//
// 	init() {
// 		this.reassignIdleCreeps(HealerSetup.role);
// 		let meleePotential = _.sum(_.map(this.room.dangerousHostiles,
// 										 hostile => CombatIntel.getAttackPotential(hostile)));
// 		// Match the hostile potential times some multiplier
// 		let amount = 0.5 * meleePotential / HealerSetup.getBodyPotential(ATTACK, this.colony);
// 		// amount = Math.max(amount, maxAmount);
// 		this.wishlist(amount, HealerSetup);
// 	}
//
// 	run() {
// 		for (let defender of this.defenders) {
// 			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
// 			if (defender.hasValidTask) {
// 				defender.run();
// 			} else {
// 				if (defender.needsBoosts && this.labsHaveBoosts()) {
// 					this.handleBoosting(defender);
// 				} else {
// 					this.handleDefender(defender);
// 				}
// 			}
// 		}
// 		if (this.room.hostiles.length == 0) {
// 			this.parkCreepsIfIdle(this.defenders);
// 		}
// 	}
// }
