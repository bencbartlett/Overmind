// import {CombatCreepSetup} from '../../creepSetups/CombatCreepSetup';
// import {CreepSetup} from '../../creepSetups/CreepSetup';
// import {CombatSetups, Roles} from '../../creepSetups/setups';
// import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
// import {CombatIntel} from '../../intel/CombatIntel';
// import {OverlordPriority} from '../../priorities/priorities_overlords';
// import {profile} from '../../profiler/decorator';
// import {BOOST_TIERS} from '../../resources/map_resources';
// import {CombatZerg} from '../../zerg/CombatZerg';
// import {CombatOverlord} from '../CombatOverlord';
//
// /**
//  * Spawns melee defenders to defend against incoming player invasions in an owned room
//  */
// @profile
// export class MeleeDefenseOverlord extends CombatOverlord {
//
// 	zerglings: CombatZerg[];
// 	room: Room;
//
// 	static settings = {
// 		retreatHitsPercent : 0.75,
// 		reengageHitsPercent: 0.95,
// 	};
//
// 	constructor(directive: DirectiveInvasionDefense, priority = OverlordPriority.defense.meleeDefense) {
// 		super(directive, 'meleeDefense', priority, 1);
// 		this.zerglings = this.combatZerg(Roles.melee);
// 	}
//
// 	private handleDefender(zergling: CombatZerg): void {
// 		if (this.directive.room && (zergling.room.hostiles.length > 0 || this.directive.room.hostiles.length > 0)) {
// 			zergling.autoCombat(this.directive.room.name);
// 		}
// 	}
//
// 	private computeNeededZerglingAmount(setup: CombatCreepSetup, boostMultiplier: number): number {
// 		const healAmount = CombatIntel.maxHealingByCreeps(this.room.hostiles);
// 		const zerglingDamage = ATTACK_POWER * boostMultiplier * setup.getBodyPotential(ATTACK, this.colony);
// 		const towerDamage = this.room.hostiles[0] ? CombatIntel.towerDamageAtPos(this.room.hostiles[0].pos) || 0 : 0;
// 		const worstDamageMultiplier = _.min(_.map(this.room.hostiles,
// 												  creep => CombatIntel.minimumDamageTakenMultiplier(creep)));
// 		return Math.ceil(.5 + 1.5 * healAmount / (worstDamageMultiplier * (zerglingDamage + towerDamage + 1)));
// 	}
//
// 	init() {
// 		this.reassignIdleCreeps(Roles.melee);
// 		const setup = new CombatCreepSetup(Roles.melee, () =>
// 			CombatCreepSetup.createZerglingBody(this.colony, {boosted:true, armored:true}));
// 		this.wishlist(this.computeNeededZerglingAmount(setup, 1), setup); // TODO: boost multiplier needs fixing!
// 	}
//
// 	run() {
// 		this.autoRun(this.zerglings, zergling => this.handleDefender(zergling));
// 	}
// }
