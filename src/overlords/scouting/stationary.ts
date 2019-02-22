import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Directive} from '../../directives/Directive';
import {Roles, Setups} from '../../creepSetups/setups';

/**
 * Sends out a stationary scout, which travels to a waypoint and remains there indefinitely
 */
@profile
export class StationaryScoutOverlord extends Overlord {

	scouts: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.scouting.stationary) {
		super(directive, 'scout', priority);
		this.scouts = this.zerg(Roles.scout, {notifyWhenAttacked: false});
	}

	init() {
		this.wishlist(1, Setups.scout);
	}

	run() {
		for (let scout of this.scouts) {
			if (!(scout.pos.inRangeTo(this.pos, 3) && !scout.pos.isEdge)) {
				scout.goTo(this.pos, {range: 3});
			}
		}
	}
}
