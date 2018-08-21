// archer overlord - spawns defender/healer pairs for sustained combat

import {OverlordPriority} from '../../priorities/priorities_overlords';
import {CreepSetup} from '../CreepSetup';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';
import {CombatIntel} from '../../intel/CombatIntel';
import {Overlord} from '../Overlord';
import {CombatZerg} from '../../zerg/CombatZerg';

export const HydraliskSetup = new CreepSetup('hydralisk', {
	pattern  : [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, MOVE, MOVE, MOVE, MOVE],
	sizeLimit: Infinity,
});

export const BoostedHydraliskSetup = new CreepSetup('hydralisk', {
	pattern  : [TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, MOVE],
	sizeLimit: Infinity,
});


@profile
export class RangedDefenseOverlord extends Overlord {

	defenders: CombatZerg[];
	// private avoid: RoomPosition[];
	// private moveOpts: MoveOptions;
	// private retreatPos: RoomPosition;
	room: Room;

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense,
				boosted  = false,
				priority = OverlordPriority.defense.rangedDefense) {
		super(directive, 'rangedDefense', priority);
		this.defenders = _.map(this.creeps(HydraliskSetup.role), creep => new CombatZerg(creep));
		if (boosted) {
			this.boosts[HydraliskSetup.role] = [
				boostResources.ranged_attack[3],
				boostResources.heal[3],
			];
		}
		// this.retreatPos = this.colony.pos;
		// this.avoid = CombatIntel.getPositionsNearEnemies(this.room.dangerousHostiles, 2);
		// this.moveOpts = {
		// 	obstacles   : this.avoid,
		// 	ignoreCreeps: false,
		// };
	}

	// private findTarget(archer: CombatZerg): Creep | Structure | undefined {
	// 	if (this.room) {
	// 		// Target nearby hostile creeps
	// 		let creepTarget = CombatTargeting.findClosestHostile(archer, false, false);
	// 		if (creepTarget) return creepTarget;
	// 		// Target nearby hostile structures
	// 		let structureTarget = CombatTargeting.findClosestPrioritizedStructure(archer);
	// 		if (structureTarget) return structureTarget;
	// 	}
	// }
	//
	// private retreatActions(archer: CombatZerg): void {
	// 	archer.goTo(this.retreatPos, this.moveOpts);
	// 	if (archer.hits > RangedDefenseOverlord.settings.reengageHitsPercent * archer.hits) {
	// 		archer.memory.retreating = false;
	// 	}
	// }
	//
	// private attackActions(attacker: CombatZerg): void {
	// 	let target = this.findTarget(attacker);
	// 	if (target) {
	// 		// console.log(attacker.name, target.pos.print);
	//
	// 		let range = attacker.pos.getRangeTo(target);
	// 		if (range <= 3) {
	// 			attacker.rangedAttack(target);
	// 		}
	// 		if (range < 3) { // retreat to controller if too close
	// 			attacker.goTo(this.retreatPos, this.moveOpts);
	// 		} else if (range > 3) { // approach the target if too far
	// 			// if (target.pos.rangeToEdge >= 2) {
	// 			attacker.goTo(target, _.merge(this.moveOpts, {range: 3}));
	// 			// }
	// 		}
	// 	}
	// }
	//
	// private healActions(defender: CombatZerg): void {
	// 	if (this.room.hostiles.length == 0) { // No hostiles in the room
	// 		defender.doMedicActions();
	// 		return;
	// 	}
	//
	// 	if (defender.hits < defender.hitsMax) {
	// 		defender.heal(defender);
	// 	} else {
	// 		// Try to heal whatever else is in range
	// 		let target = defender.pos.findClosestByRange(_.filter(this.defenders, creep => creep.hits < creep.hitsMax));
	// 		if (target && target.pos.isNearTo(defender)) {
	// 			defender.heal(target, false);
	// 		}
	// 		if (target && !defender.actionLog.move) {
	// 			defender.goTo(target, this.moveOpts);
	// 		}
	// 	}
	// }


	private handleDefender(defender: CombatZerg): void {
		// // Handle retreating actions
		// if (defender.hits < RangedDefenseOverlord.settings.retreatHitsPercent * defender.hitsMax) {
		// 	defender.memory.retreating = true;
		// }
		// if (defender.memory.retreating) {
		// 	this.retreatActions(defender);
		// }
		// // Move to room and then perform attacking actions
		// if (!defender.inSameRoomAs(this) || defender.pos.isEdge) {
		// 	defender.goTo(this.pos);
		// } else {
		// 	this.attackActions(defender);
		// 	this.healActions(defender);
		// }
		if (defender.room.hostiles.length > 0) {
			defender.autoCombat(defender.room.name);
		} else {
			defender.doMedicActions();
		}
	}

	init() {
		this.reassignIdleCreeps(HydraliskSetup.role);
		let healPotential = CombatIntel.maxHealingByCreeps(this.room.hostiles);
		let hydraliskDamage = RANGED_ATTACK_POWER * HydraliskSetup.getBodyPotential(RANGED_ATTACK, this.colony);
		let towerDamage = this.room.hostiles[0] ? CombatIntel.towerDamageAtPos(this.room.hostiles[0].pos) || 0 : 0;
		let worstDamageMultiplier = _.min(_.map(this.room.hostiles, creep => CombatIntel.minimumDamageTakenMultiplier(creep)));
		let boosts = this.boosts[HydraliskSetup.role];
		if (boosts && boosts.includes(boostResources.ranged_attack[3])) { // TODO: add boost damage computation function to Overlord
			hydraliskDamage *= 4;
		}
		// Match the hostile damage times some multiplier
		let amount = Math.ceil(.5 + 1.5 * healPotential / (worstDamageMultiplier * (hydraliskDamage + towerDamage)));
		this.wishlist(amount, HydraliskSetup);
		this.requestBoosts(this.defenders);
	}

	run() {
		this.autoRunCombat(this.defenders, defender => this.handleDefender(defender));
	}
}
