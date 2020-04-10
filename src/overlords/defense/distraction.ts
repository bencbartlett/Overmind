import {CombatSetups, Roles} from '../../creepSetups/setups';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';

/**
 * 5 Move 1 RA creep that avoids all enemies and distracts attackers.
 * Just for fun
 * TODO: Make them prefer swamps when at max hp
 */
@profile
export class DistractionOverlord extends CombatOverlord {

	distractions: CombatZerg[];
	room: Room | undefined;

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: Directive,
				boosted  = false,
				priority = OverlordPriority.defense.rangedDefense) {
		super(directive, 'distraction', priority, 1);
		this.distractions = this.combatZerg(Roles.rangedDistractor);
	}

	private handleDistraction(distraction: CombatZerg): void {
		if (this.room && this.room.hostiles.length > 0) {
			distraction.autoCombat(this.room.name, false, 5, {preferRamparts: false});
			DistractionOverlord.taunt(distraction, this.room.hostiles[0].owner.username);
			const nearbyHostiles = this.room.hostiles.filter(hostile => hostile.pos.getRangeTo(distraction) <= 6);
			if (nearbyHostiles.length > 0) {
				distraction.kite(nearbyHostiles);
			}
		}
	}

	static taunt(distraction: CombatZerg, name?: string) {
		const taunts: string[] = ['Heylisten!', 'Pssssst', 'So close', '🎣', 'Try harder', 'Get good;)', 'Base ⬆️', '🔜',
								  '⚠️Swamp⚠️', 'Follow me!', 'Catch Me!', `Hi ${name || ''}`, '🍑🍑🍑', '🏎️ VROOM'];
		distraction.sayRandom(taunts, true);
	}

	init() {
		// this.reassignIdleCreeps(Roles.ranged); until it's it's own role don't reassign
		const setup = CombatSetups.distractors.ranged;
		this.wishlist(1, setup);
	}

	run() {
		// need to check room exists
		// console.log(`Distraction overlord running in ${this.room.print} with ${this.distractions}!`);
		this.autoRun(this.distractions, distraction => this.handleDistraction(distraction));
	}
}
