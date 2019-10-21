import {CreepSetup} from '../../creepSetups/CreepSetup';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {CombatIntel} from '../../intel/CombatIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';
import {DirectiveStronghold} from "../../directives/situational/stronghold";
import {Visualizer} from "../../visuals/Visualizer";

/**
 * Spawns ranged attacker against stronghold
 */
@profile
export class StrongholdOverlord extends CombatOverlord {

	strongholdKillers: CombatZerg[];

	room: Room;
	directive: DirectiveStronghold;

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveStronghold,
				priority = OverlordPriority.defense.rangedDefense) {
		super(directive, 'stronghold', priority, 1);
		this.strongholdKillers = this.combatZerg(Roles.strongholdKiller, {
			boostWishlist: [boostResources.tough[3], boostResources.ranged_attack[3],
					boostResources.heal[3], boostResources.move[3]]
		});
	}

	private findAttackingPosition(targetLocation: RoomPosition): RoomPosition | undefined {
		if (!targetLocation.room) {return;}
		//let enemyPositions = targetLocation.findInRange(3, FIND_HOSTILE_STRUCTURES);
		let ramparts = targetLocation.room.ramparts; // theoretically breaks with shield power
		let shootPositions = targetLocation.getPositionsAtRange(3, false, false);

		let rampartPos = ramparts.map(rampart => rampart.pos);
		// Kinda funky since doing 5 instead of 6 to do distance of 1
		let nearSKPos = targetLocation.room.keeperLairs.flatMap(lair => lair.pos.getPositionsInRange(5, false, false));

		let safeSpots = this.findSafeLocation(shootPositions, rampartPos.concat(nearSKPos));

		if (safeSpots.length > 0) {
			// TODO Also filter for SK positions
			_.forEach(safeSpots, spot => Visualizer.marker(spot, {color: 'green'}));
			return safeSpots[0];
		} else {
			// rework for next level
		}

		// Next filter for locations to kill to open another


		return;
	}

	private findSafeLocation(locations: RoomPosition[], avoidLocations: RoomPosition[], allowedAvoids: number = 0): RoomPosition[] {

		// Should probably do cost matrix to avoid ramparts, wrote a getNearRampartsMatrix in pathing but need to use it
		let validLocs = locations.filter(loc => {
			let count = 0;
			for (let avoid of avoidLocations) {
				if (loc.isNearTo(avoid)) {
					count++;
				}
			}
			return count <= allowedAvoids;
		});

		return validLocs;
	}

	private handleKiller(killer: CombatZerg): void {
		killer.heal(killer);
		if (killer.pos.getRangeTo(this.directive.pos) > 5) {
			killer.goTo(this.directive.pos);
		}

		// Need to kill corner first, then move on


		// if (this.room.hostiles.length > 0) {
		// 	hydralisk.heal(hydralisk); // heal self if no other targets
		// 	hydralisk.autoCombat(this.room.name);
		// } else {
		// 	if (hydralisk.pos.getRangeTo(this.directive.pos) > 5) {
		// 		hydralisk.goTo(this.directive.pos);
		// 	}
		// 	hydralisk.doMedicActions(this.room.name);
		// }
	}



	init() {
		this.reassignIdleCreeps(Roles.strongholdKiller);
		let setup;
		switch(this.directive.memory.strongholdLevel) {
			case 5:
				return; // Fuck this shit we out
			case 4:
				setup = CombatSetups.strongholdKiller["4"];
				break;
			case 3:
				setup = CombatSetups.strongholdKiller["3"];
				break;
			case 0:
				return; // Forget it, no need for the lil ones
			default:
				setup = CombatSetups.strongholdKiller["3"];
		}

		if (!this.canBoostSetup(setup)) {
			// Need boosts
			return;
		}

		//this.wishlist(1, setup)
	}

	run() {
		if (this.room) {
			const core = this.room.find(FIND_HOSTILE_STRUCTURES).filter(struct => struct.structureType.toString() == 'invaderCore');
			if (core.length > 0) {
				this.findAttackingPosition(core[0].pos);
			}
		}
		this.autoRun(this.strongholdKillers, killer => this.handleKiller(killer));
	}
}
