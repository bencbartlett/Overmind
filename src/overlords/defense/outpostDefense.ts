import {CombatCreepSetup} from '../../creepSetups/CombatCreepSetup';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveOutpostDefense} from '../../directives/defense/outpostDefense';
import {CombatIntel, CombatPotentials} from '../../intel/CombatIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';

/**
 * General purpose skirmishing overlord for dealing with player combat in an outpost
 */
@profile
export class OutpostDefenseOverlord extends CombatOverlord {

	zerglings: CombatZerg[];
	hydralisks: CombatZerg[];
	healers: CombatZerg[];

	constructor(directive: DirectiveOutpostDefense, priority = OverlordPriority.outpostDefense.outpostDefense) {
		super(directive, 'outpostDefense', priority, 1);
		// this.spawnGroup.settings.flexibleEnergy = true;
		this.zerglings = this.combatZerg(Roles.melee);
		this.hydralisks = this.combatZerg(Roles.ranged);
		this.healers = this.combatZerg(Roles.healer);
	}

	private handleCombat(zerg: CombatZerg) {
		if (this.room && this.room.hostiles.length == 0) {
			zerg.doMedicActions(this.room.name);
		} else {
			zerg.autoSkirmish(this.pos.roomName);
		}
	}

	private handleHealer(healer: CombatZerg) {
		if (CombatIntel.isHealer(healer) && healer.getActiveBodyparts(HEAL) == 0) {
			if (this.colony.towers.length > 0) {
				return healer.goToRoom(this.colony.room.name); // go get healed
			} else {
				return healer.suicide(); // you're useless at this point // TODO: this isn't smart
			}
		} else {
			if (this.room && _.any([...this.zerglings, ...this.hydralisks], creep => creep.room == this.room)) {
				this.handleCombat(healer); // go to room if there are any fighters in there
			} else {
				healer.autoSkirmish(healer.room.name);
			}
		}
	}

	// private computeNeededHydraliskAmount(setup: CombatCreepSetup, enemyRangedPotential: number): number {
	// 	const hydraliskPotential = setup.getBodyPotential(RANGED_ATTACK, this.colony);
	// 	// TODO: body potential from spawnGroup energy?
	// 	// let worstDamageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(this.room.hostiles);
	// 	// TODO this was reduced from 1.5 due to draining, but should be re-evaluated when we have infra in place to track
	// 	// If a directive is being too costly
	// 	return Math.ceil(1.1 * enemyRangedPotential / hydraliskPotential);
	// }
	//
	// // TODO: division by 0 error!
	// private computeNeededBroodlingAmount(setup: CombatCreepSetup, enemyAttackPotential: number): number {
	// 	const broodlingPotential = setup.getBodyPotential(ATTACK, this.colony);
	// 	// let worstDamageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(this.room.hostiles);
	// 	return Math.ceil(1.1 * enemyAttackPotential / broodlingPotential);
	// }
	//
	// private computeNeededHealerAmount(setup: CombatCreepSetup, enemyHealPotential: number): number {
	// 	const healerPotential = setup.getBodyPotential(HEAL, this.colony);
	// 	return Math.ceil(1.1 * enemyHealPotential / healerPotential);
	// }

	private getEnemyPotentials(): CombatPotentials {
		if (this.room) {
			return CombatIntel.getCombatPotentials(this.room.hostiles);
		} else {
			return {attack: 0, ranged: 1, heal: 0,};
		}
	}

	init() {
		const enemyPotentials = this.getEnemyPotentials();
		const needAttack = enemyPotentials.attack * 1.1;
		const needRanged = enemyPotentials.ranged * 1.3;
		const needHeal = enemyPotentials.heal * 1.2;

		if (needAttack > 100 || needRanged > 100 || needHeal > 100) {
			return; // fuck it let's not fight this
		}

		// Only try to obtain one additional creep at a time
		if (this.reassignIdleCreeps(Roles.melee, 1)) return;
		if (this.reassignIdleCreeps(Roles.ranged, 1)) return;
		if (this.reassignIdleCreeps(Roles.healer, 1)) return;

		const noBigColoniesNearby = _.all(this.spawnGroup.colonies, col => col.room.energyCapacityAvailable < 800);

		const myPotentials = CombatIntel.getMyCombatPotentials([...this.zerglings,
																...this.hydralisks,
																...this.healers]);

		// if (attack > 30 || rangedAttack > 30) {
		// 	// Handle boost worthy attackers
		// 	this.wishlist(1, CombatSetups.hydralisks.boosted_T3);
		// }

		const hydraliskSetup = noBigColoniesNearby ? CombatSetups.hydralisks.noHeal : CombatSetups.hydralisks.default;
		const zerglingSetup = noBigColoniesNearby ? CombatSetups.zerglings.default : CombatSetups.zerglings.healing;
		const healerSetup = CombatSetups.transfusers.default;

		if (myPotentials.ranged < needRanged) {
			this.requestCreep(hydraliskSetup);
		} else if (myPotentials.heal < needHeal) {
			this.requestCreep(healerSetup);
		} else if (myPotentials.attack < needAttack) {
			this.requestCreep(zerglingSetup);
		}

	}

	run() {
		this.autoRun(this.zerglings, zergling => this.handleCombat(zergling));
		this.autoRun(this.hydralisks, hydralisk => this.handleCombat(hydralisk));
		this.autoRun(this.healers, healer => this.handleHealer(healer));
	}
}
