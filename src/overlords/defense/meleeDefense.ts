// archer overlord - spawns defender/healer pairs for sustained combat

import {OverlordPriority} from '../../priorities/priorities_overlords';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';
import {CombatIntel} from '../../intel/CombatIntel';
import {CreepSetup} from '../CreepSetup';
import {Overlord} from '../Overlord';
import {CombatZerg} from '../../zerg/CombatZerg';

export const ZerglingSetup = new CreepSetup('zergling', {
	pattern  : [ATTACK, MOVE],
	sizeLimit: Infinity,
});

export const ArmoredZerglingSetup = new CreepSetup('zergling', {
	pattern  : [TOUGH, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE],
	sizeLimit: Infinity,
});

@profile
export class MeleeDefenseOverlord extends Overlord {

	zerglings: CombatZerg[];
	room: Room;

	static settings = {
		retreatHitsPercent : 0.75,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense, boosted = false, priority = OverlordPriority.defense.meleeDefense) {
		super(directive, 'meleeDefense', priority);
		this.zerglings = _.map(this.creeps(ZerglingSetup.role), creep => new CombatZerg(creep));
		if (boosted) {
			this.boosts[ZerglingSetup.role] = [
				boostResources.tough[3],
				boostResources.attack[3],
			];
		}
	}

	private handleDefender(zergling: CombatZerg): void {
		if (zergling.room.hostiles.length > 0) {
			zergling.autoCombat(zergling.room.name);
		}
	}

	init() {
		this.reassignIdleCreeps(ZerglingSetup.role);
		let healPotential = CombatIntel.maxHealingByCreeps(this.room.hostiles);
		let zerglingDamage = ATTACK_POWER * ZerglingSetup.getBodyPotential(ATTACK, this.colony);
		let towerDamage = this.room.hostiles[0] ? CombatIntel.towerDamageAtPos(this.room.hostiles[0].pos) || 0 : 0;
		let worstDamageMultiplier = _.min(_.map(this.room.hostiles, creep => CombatIntel.minimumDamageTakenMultiplier(creep)));
		let boosts = this.boosts[ZerglingSetup.role];
		if (boosts && boosts.includes(boostResources.attack[3])) { // TODO: add boost damage computation function to Overlord
			zerglingDamage *= 4;
		}
		// Match the hostile damage times some multiplier
		let amount = Math.ceil(.5 + 1.5 * healPotential / (worstDamageMultiplier * (zerglingDamage + towerDamage)));
		if (this.colony.level >= 3) {
			this.wishlist(amount, ArmoredZerglingSetup);
		} else {
			this.wishlist(amount, ZerglingSetup);
		}
		this.requestBoosts(this.zerglings);
	}

	run() {
		this.autoRunCombat(this.zerglings, zergling => this.handleDefender(zergling));
	}
}
