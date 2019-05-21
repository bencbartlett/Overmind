// // archer overlord - spawns defender/healer pairs for sustained combat
//
// import {OverlordPriority} from '../../priorities/priorities_overlords';
// import {CreepSetup} from '../CreepSetup';
// import {boostResources} from '../../resources/map_resources';
// import {profile} from '../../profiler/decorator';
// import {CombatIntel} from '../../intel/combatIntel';
// import {Overlord} from '../Overlord';
// import {CombatZerg} from '../../zerg/CombatZerg';
// import {CombatTargeting} from '../../targeting/CombatTargeting';
// import {MoveOptions} from '../../movement/Movement';
// import {DirectiveGuard} from '../../directives/defense/guard';
// import {Mem} from '../../Memory';
// import {Pathing} from '../../movement/Pathing';
//
// const RangedGuardSetup = new CreepSetup('hydralisk', {
// 	pattern  : [RANGED_ATTACK, MOVE],
// 	sizeLimit: Infinity,
// });
//
//
// @profile
// export class RangedDefenseOverlord extends Overlord {
//
// 	memory: {
// 		retreatPos?: ProtoPos;
// 	};
//
// 	defenders: CombatZerg[];
// 	private avoid: RoomPosition[];
// 	private moveOpts: MoveOptions;
// 	private retreatPos: RoomPosition;
// 	room: Room;
// 	settings: {
// 		retreatHitsPercent: number,
// 		reengageHitsPercent: number,
// 	};
//
// 	constructor(directive: DirectiveGuard, priority = OverlordPriority.defense.rangedDefense) {
// 		super(directive, 'rangedDefense', priority);
// 		this.memory = Mem.wrap(directive.memory, this.ref, {});
// 		this.defenders = _.map(this.creeps(RangedGuardSetup.role), creep => new CombatZerg(creep));
// 		this.retreatPos = this.findRetreatPos() || this.colony.pos;
// 		this.settings = {
// 			retreatHitsPercent : 0.85,
// 			reengageHitsPercent: 0.95,
// 		};
// 		this.avoid = CombatIntel.getPositionsNearEnemies(this.room.dangerousHostiles, 2);
// 		this.moveOpts = {
// 			obstacles   : this.avoid,
// 			ignoreCreeps: false,
// 		};
// 	}
//
// 	private findRetreatPos(): RoomPosition {
// 		if (this.memory.retreatPos) {
// 			return derefRoomPosition(this.memory.retreatPos);
// 		}
// 		let ret = Pathing.findPath(this.pos, this.colony.pos);
// 		if (!ret.incomplete) {
// 			let nextRoomPos = _.find(ret.path, pos => pos.roomName != this.pos.roomName && pos.rangeToEdge >=3);
// 			if (nextRoomPos) {
// 				this.memory.retreatPos = nextRoomPos;
// 				return nextRoomPos;
// 			}
// 		}
// 		return this.colony.pos;
// 	}
//
// 	private findTarget(archer: CombatZerg): Creep | Structure | undefined {
// 		if (this.room) {
// 			// Target nearby hostile creeps
// 			let creepTarget = CombatTargeting.findClosestHostile(archer, false, false);
// 			if (creepTarget) return creepTarget;
// 			// Target nearby hostile structures
// 			let structureTarget = CombatTargeting.findClosestPrioritizedStructure(archer);
// 			if (structureTarget) return structureTarget;
// 		}
// 	}
//
// 	private retreatActions(archer: CombatZerg): void {
// 		archer.goTo(this.retreatPos, this.moveOpts);
// 		if (archer.hits > this.settings.reengageHitsPercent * archer.hits) {
// 			archer.memory.retreating = false;
// 		}
// 	}
//
// 	private attackActions(attacker: CombatZerg): void {
// 		let target = this.findTarget(attacker);
// 		if (target) {
// 			// console.log(attacker.name, target.pos.print);
//
// 			let range = attacker.pos.getRangeTo(target);
// 			if (range <= 3) {
// 				attacker.rangedAttack(target);
// 			}
// 			if (range < 3) { // retreat to controller if too close
// 				attacker.goTo(this.retreatPos, this.moveOpts);
// 			} else if (range > 3) { // approach the target if too far
// 				// if (target.pos.rangeToEdge >= 2) {
// 				attacker.goTo(target, _.merge(this.moveOpts, {range: 3}));
// 				// }
// 			}
// 		}
// 	}
//
// 	private healActions(defender: CombatZerg): void {
// 		if (this.room && this.room.hostiles.length == 0) { // No hostiles in the room
// 			defender.doMedicActions();
// 			return;
// 		}
//
// 		if (defender.hits < defender.hitsMax) {
// 			defender.heal(defender);
// 		} else {
// 			// Try to heal whatever else is in range
// 			let target = defender.pos.findClosestByRange(_.filter(this.defenders, creep => creep.hits < creep.hitsMax));
// 			if (target && target.pos.isNearTo(defender)) {
// 				defender.heal(target, false);
// 			}
// 			if (target && !defender.actionLog.move) {
// 				defender.goTo(target, this.moveOpts);
// 			}
// 		}
// 	}
//
//
// 	private handleDefender(defender: CombatZerg): void {
// 		// Handle retreating actions
// 		if (defender.hits < this.settings.retreatHitsPercent * defender.hitsMax) {
// 			defender.memory.retreating = true;
// 		}
// 		if (defender.memory.retreating) {
// 			this.retreatActions(defender);
// 		}
// 		// Move to room and then perform attacking actions
// 		if (!defender.inSameRoomAs(this) || defender.pos.isEdge) {
// 			defender.goTo(this.pos);
// 		} else {
// 			this.attackActions(defender);
// 			this.healActions(defender);
// 		}
// 	}
//
// 	init() {
// 		this.reassignIdleCreeps(RangedGuardSetup.role);
// 		let healPotential = CombatIntel.maxHealingByCreeps(this.room.hostiles);
// 		let hydraliskDamage = RANGED_ATTACK_POWER * RangedGuardSetup.getBodyPotential(RANGED_ATTACK, this.colony);
// 		let towerDamage = this.room.hostiles[0] ? CombatIntel.towerDamageAtPos(this.room.hostiles[0].pos) || 0 : 0;
// 		let worstDamageMultiplier = _.min(_.map(this.room.hostiles, creep => CombatIntel.minimumDamageTakenMultiplier(creep)));
// 		let boosts = this.boosts[RangedGuardSetup.role];
// 		if (boosts && boosts.includes(boostResources.ranged_attack[3])) { // TODO: add boost damage computation function to Overlord
// 			hydraliskDamage *= 4;
// 		}
// 		// Match the hostile damage times some multiplier
// 		let amount = Math.ceil(1.5 * healPotential / (worstDamageMultiplier * (hydraliskDamage + towerDamage)));
// 		this.wishlist(amount, RangedGuardSetup);
// 		this.requestBoosts(this.defenders);
// 	}
//
// 	run() {
// 		for (let defender of this.defenders) {
// 			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
// 			if (defender.hasValidTask) {
// 				defender.run();
// 			} else {
// 				if (defender.needsBoosts) {
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
