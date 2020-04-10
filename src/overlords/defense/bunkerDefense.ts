import {log} from '../../console/log';
import {CombatCreepSetup} from '../../creepSetups/CombatCreepSetup';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';

/**
 * Spawns bunker-only defenders to defend against incoming sieges // TODO: needs some revision
 */
@profile
export class BunkerDefenseOverlord extends CombatOverlord {

	defenders: CombatZerg[];
	room: Room;

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense, priority = OverlordPriority.defense.meleeDefense) {
		// Only spawn inside room
		super(directive, 'bunkerDefense', priority, 1, 30);
		this.defenders = this.combatZerg(Roles.bunkerDefender);
	}

	private handleDefender(lurker: CombatZerg): void {
		if (!lurker.inRampart) {
			const nearbyRampart = _.find(lurker.room.walkableRamparts, rampart => rampart.pos.getRangeTo(lurker) < 5);
			if (nearbyRampart) {
				lurker.goTo(nearbyRampart);
			}
		}
		if (lurker.room.hostiles.length > 0) {
			lurker.autoBunkerCombat(lurker.room.name);
		} else {
			// go out of way in bunker
		}
	}

	init() {
		this.reassignIdleCreeps(Roles.bunkerDefender);

		this.wishlist(1, CombatSetups.bunkerDefender.boosted);
	}

	run() {
		this.autoRun(this.defenders, defender => this.handleDefender(defender));
	}
}
