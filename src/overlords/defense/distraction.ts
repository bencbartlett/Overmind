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
 * 5 Move 1 RA creep that avoids all enemies and distracts attackers.
 * Just for fun
 * TODO: Make them prefer swamps when at max hp
 */
@profile
export class DistractionOverlord extends CombatOverlord {

	distraction: CombatZerg[];
	room: Room;

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense,
				boosted  = false,
				priority = OverlordPriority.defense.rangedDefense) {
		super(directive, 'distraction', priority, 1);
		this.distraction = this.combatZerg(Roles.ranged);
	}

	private handleDistraction(distraction: CombatZerg): void {
		if (this.room.hostiles.length > 0) {
			distraction.autoCombat(this.room.name, false, 5);
			this.taunt(distraction, this.room.hostiles[0].owner.username);
		}
	}

	taunt(distraction: CombatZerg, name?: string) {
		const taunts: string[] = ['Heylisten!', 'Pssssst', 'Catch Me!', `Hi ${name || ''}`, '🍑🍑🍑', '🏎️ VROOM'];
		distraction.sayRandom(taunts, true);
	}

	init() {
		this.reassignIdleCreeps(Roles.ranged);
		const setup = CombatSetups.hydralisks.distraction;
		this.wishlist(1, setup);
	}

	run() {
		this.autoRun(this.distraction, distraction => this.handleDistraction(distraction));
	}
}
