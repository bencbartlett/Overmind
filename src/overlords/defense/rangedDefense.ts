// archer overlord - spawns defender/healer pairs for sustained combat

import {OverlordPriority} from '../../priorities/priorities_overlords';
import {CreepSetup} from '../CreepSetup';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';
import {CombatIntel} from '../../intel/CombatIntel';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';

export const HydraliskSetup = new CreepSetup('hydralisk', {
	pattern  : [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, MOVE, MOVE, MOVE, MOVE],
	sizeLimit: Infinity,
});

export const BoostedHydraliskSetup = new CreepSetup('hydralisk', {
	pattern  : [TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, MOVE],
	sizeLimit: Infinity,
});


@profile
export class RangedDefenseOverlord extends CombatOverlord {

	hydralisks: CombatZerg[];
	room: Room;

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense,
				boosted  = false,
				priority = OverlordPriority.defense.rangedDefense) {
		super(directive, 'rangedDefense', priority, 1);
		this.hydralisks = this.combatZerg(HydraliskSetup.role);
		if (boosted) {
			this.boosts[HydraliskSetup.role] = [
				boostResources.ranged_attack[3],
				boostResources.heal[3],
			];
		}
	}

	private handleDefender(hydralisk: CombatZerg): void {
		if (hydralisk.room.hostiles.length > 0) {
			hydralisk.autoCombat(hydralisk.room.name);
		} else {
			hydralisk.doMedicActions();
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
		this.requestBoosts(this.hydralisks);
	}

	run() {
		this.autoRun(this.hydralisks, hydralisk => this.handleDefender(hydralisk));
	}
}
