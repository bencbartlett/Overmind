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
 * Spawns bunker-only defenders to defend against incoming sieges
 */
@profile
export class BunkerDefenseOverlord extends CombatOverlord {

	lurkers: CombatZerg[];
	room: Room;

	static settings = {
		retreatHitsPercent : 0.75,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense, boosted = false, priority = OverlordPriority.defense.meleeDefense) {
		// Only spawn inside room
		super(directive, 'bunkerDefense', priority, 1, 30);
		this.lurkers = this.combatZerg(Roles.bunkerGuard, {
			boostWishlist: boosted ? [boostResources.attack[3], boostResources.move[3]]
								   : undefined
		});
	}

	private handleDefender(zergling: CombatZerg): void {
		if (zergling.room.hostiles.length > 0) {
			console.log(`Running actual defender in room ${this.room.print}`);
			zergling.autoBunkerCombat(zergling.room.name);
		}
	}

	init() {
		this.reassignIdleCreeps(Roles.melee);
		if (this.canBoostSetup(CombatSetups.bunkerGuard.boosted_T3)) {
			const setup = CombatSetups.bunkerGuard.boosted_T3;
			this.wishlist(1, setup);
		}
	}

	run() {
		this.autoRun(this.lurkers, zergling => this.handleDefender(zergling));
	}
}
