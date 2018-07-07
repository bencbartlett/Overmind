import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {ScoutSetup} from './stationary';
import {Colony} from '../../Colony';


@profile
export class RandomWalkerScoutOverlord extends Overlord {

	scouts: Zerg[];

	constructor(colony: Colony, priority = OverlordPriority.scouting.randomWalker) {
		super(colony, 'scout', priority);
		// Change priority to operate per-outpost
		this.priority += this.outpostIndex * OverlordPriority.remoteRoom.roomIncrement;
		this.scouts = this.zerg(ScoutSetup.role);
	}

	init() {
		this.wishlist(1, ScoutSetup);
	}

	run() {
		for (let scout of this.scouts) {
			if (!scout.pos.inRangeTo(this.pos, 3) && !scout.pos.isEdge) {
				scout.goTo(this.pos, {range: 3});
			}
		}
	}
}
