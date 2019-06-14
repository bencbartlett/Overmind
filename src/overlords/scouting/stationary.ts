import {Roles, Setups} from '../../creepSetups/setups';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

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
		for (const scout of this.scouts) {
			if (this.pos.roomName == scout.room.name) {
				const enemyConstructionSites = scout.room.find(FIND_HOSTILE_CONSTRUCTION_SITES);
				const squashTarget = _.first(enemyConstructionSites);
				if (squashTarget) {
					scout.goTo(squashTarget);
					return;
				}
			}

			if (!(scout.pos.inRangeTo(this.pos, 3) && !scout.pos.isEdge)) {
				scout.goTo(this.pos, {range: 3});
			}
		}
	}
}
