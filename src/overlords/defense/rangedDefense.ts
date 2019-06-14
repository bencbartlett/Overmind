import {CreepSetup} from '../../creepSetups/CreepSetup';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {CombatIntel} from '../../intel/CombatIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';

/**
 * Spawns ranged defenders to defend against incoming player invasions in an owned room
 */
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
		this.hydralisks = this.combatZerg(Roles.ranged, {
			boostWishlist: boosted ? [boostResources.tough[3], boostResources.ranged_attack[3],
					boostResources.heal[3], boostResources.move[3]] : undefined
		});
	}

	private handleDefender(hydralisk: CombatZerg): void {
		if (this.room.hostiles.length > 0) {
			hydralisk.autoCombat(this.room.name);
		} else {
			hydralisk.doMedicActions(this.room.name);
		}
	}

	private computeNeededHydraliskAmount(setup: CreepSetup, boostMultiplier: number): number {
		const healAmount = CombatIntel.maxHealingByCreeps(this.room.hostiles);
		const hydraliskDamage = RANGED_ATTACK_POWER * boostMultiplier
							  * setup.getBodyPotential(RANGED_ATTACK, this.colony);
		const towerDamage = this.room.hostiles[0] ? CombatIntel.towerDamageAtPos(this.room.hostiles[0].pos) || 0 : 0;
		const worstDamageMultiplier = _.min(_.map(this.room.hostiles,
												creep => CombatIntel.minimumDamageTakenMultiplier(creep)));
		return Math.ceil(.5 + 1.5 * healAmount / (worstDamageMultiplier * (hydraliskDamage + towerDamage + 1)));
	}

	init() {
		this.reassignIdleCreeps(Roles.ranged);
		if (this.canBoostSetup(CombatSetups.hydralisks.boosted_T3)) {
			const setup = CombatSetups.hydralisks.boosted_T3;
			this.wishlist(this.computeNeededHydraliskAmount(setup, BOOSTS.ranged_attack.XKHO2.rangedAttack), setup);
		} else {
			const setup = CombatSetups.hydralisks.default;
			this.wishlist(this.computeNeededHydraliskAmount(setup, 1), setup);
		}
	}

	run() {
		this.autoRun(this.hydralisks, hydralisk => this.handleDefender(hydralisk));
	}
}
