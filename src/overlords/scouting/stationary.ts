import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Directive} from '../../directives/Directive';
import {CreepSetup} from '../CreepSetup';

export const ScoutSetup = new CreepSetup('scout', {
	pattern  : [MOVE],
	sizeLimit: 1,
});

@profile
export class StationaryScoutOverlord extends Overlord {

	scouts: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.scouting.stationary) {
		super(directive, 'scout', priority);
		this.scouts = this.zerg(ScoutSetup.role);
	}

	init() {
		this.wishlist(1, ScoutSetup);
	}

	run() {
		for (let scout of this.scouts) {
			if (!(scout.pos.inRangeTo(this.pos, 3) && !scout.pos.isEdge)) {
				scout.goTo(this.pos, {range: 3});
			}
		}
	}
}
