import {CreepSetup, patternCost} from '../../creepSetups/CreepSetup';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveOutpostDefense} from '../../directives/defense/outpostDefense';
import {CombatIntel} from '../../intel/CombatIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';

/**
 * General purpose skirmishing overlord for dealing with player combat in an outpost
 */
@profile
export class OutpostDefenseOverlord extends CombatOverlord {

	broodlings: CombatZerg[];
	hydralisks: CombatZerg[];
	healers: CombatZerg[];

	constructor(directive: DirectiveOutpostDefense, priority = OverlordPriority.outpostDefense.outpostDefense) {
		super(directive, 'outpostDefense', priority, 1);
		this.spawnGroup.settings.flexibleEnergy = true;
		this.broodlings = this.combatZerg(Roles.guardMelee);
		this.hydralisks = this.combatZerg(Roles.ranged);
		this.healers = this.combatZerg(Roles.healer);
	}

	private handleCombat(zerg: CombatZerg): void {
		if (this.room && this.room.hostiles.length == 0) {
			zerg.doMedicActions(this.room.name);
		} else {
			zerg.autoSkirmish(this.pos.roomName);
		}
	}

	private handleHealer(healer: CombatZerg): void {
		if (CombatIntel.isHealer(healer) && healer.getActiveBodyparts(HEAL) == 0) {
			if (this.colony.towers.length > 0) {
				healer.goToRoom(this.colony.room.name); // go get healed
			} else {
				healer.suicide(); // you're useless at this point // TODO: this isn't smart
			}
		} else {
			if (this.room && _.any([...this.broodlings, ...this.hydralisks], creep => creep.room == this.room)) {
				this.handleCombat(healer); // go to room if there are any fighters in there
			} else {
				healer.autoSkirmish(healer.room.name);
			}
		}
	}

	private computeNeededHydraliskAmount(setup: CreepSetup, enemyRangedPotential: number): number {
		const hydraliskPotential = setup.getBodyPotential(RANGED_ATTACK, this.colony);
		// TODO: body potential from spawnGroup energy?
		// let worstDamageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(this.room.hostiles);
		return Math.ceil(1.5 * enemyRangedPotential / hydraliskPotential);
	}

	// TODO: division by 0 error!
	private computeNeededBroodlingAmount(setup: CreepSetup, enemyAttackPotential: number): number {
		const broodlingPotential = setup.getBodyPotential(ATTACK, this.colony);
		// let worstDamageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(this.room.hostiles);
		return Math.ceil(1.5 * enemyAttackPotential / broodlingPotential);
	}

	private computeNeededHealerAmount(setup: CreepSetup, enemyHealPotential: number): number {
		const healerPotential = setup.getBodyPotential(HEAL, this.colony);
		return Math.ceil(1.5 * enemyHealPotential / healerPotential);
	}

	private getEnemyPotentials(): { attack: number, rangedAttack: number, heal: number } {
		if (this.room) {
			return CombatIntel.getCombatPotentials(this.room.hostiles);
		} else {
			return {attack: 1, rangedAttack: 0, heal: 0,};
		}
	}

	init() {

		const maxCost = Math.max(patternCost(CombatSetups.hydralisks.default),
								 patternCost(CombatSetups.broodlings.default));
		const mode = this.colony.room.energyCapacityAvailable >= maxCost ? 'NORMAL' : 'EARLY';

		const {attack, rangedAttack, heal} = this.getEnemyPotentials();

		const hydraliskSetup = mode == 'NORMAL' ? CombatSetups.hydralisks.default : CombatSetups.hydralisks.early;
		const hydraliskAmount = this.computeNeededHydraliskAmount(hydraliskSetup, rangedAttack);
		this.wishlist(hydraliskAmount, hydraliskSetup, {priority: this.priority - .2, reassignIdle: true});

		const broodlingSetup = mode == 'NORMAL' ? CombatSetups.broodlings.default : CombatSetups.broodlings.early;
		const broodlingAmount = this.computeNeededBroodlingAmount(broodlingSetup, attack);
		this.wishlist(broodlingAmount, broodlingSetup, {priority: this.priority - .1, reassignIdle: true});

		const enemyHealers = _.filter(this.room ? this.room.hostiles : [], creep => CombatIntel.isHealer(creep)).length;
		let healerAmount = (enemyHealers > 0 || mode == 'EARLY') ?
						   this.computeNeededHealerAmount(CombatSetups.healers.default, heal) : 0;
		if (mode == 'EARLY' && attack + rangedAttack > 0) {
			healerAmount = Math.max(healerAmount, 1);
		}
		this.wishlist(healerAmount, CombatSetups.healers.default, {priority: this.priority, reassignIdle: true});

	}

	run() {
		this.autoRun(this.broodlings, broodling => this.handleCombat(broodling));
		this.autoRun(this.hydralisks, mutalisk => this.handleCombat(mutalisk));
		this.autoRun(this.healers, healer => this.handleHealer(healer));
	}
}
