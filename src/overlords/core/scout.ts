import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/_Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Directive} from '../../directives/Directive';
import {CreepSetup} from '../CreepSetup';

const ScoutSetup = new CreepSetup('scout', {
	pattern  : [MOVE],
	sizeLimit: 1,
});

@profile
export class ScoutOverlord extends Overlord {

	scouts: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.remoteRoom.reserve) {
		super(directive, 'scout', priority);
		// Change priority to operate per-outpost
		this.priority += this.outpostIndex * OverlordPriority.remoteRoom.roomIncrement;
		this.scouts = this.zerg(ScoutSetup.role);
	}

	init() {
		this.wishlist(1, ScoutSetup);
	}

	private handleScout(scout: Zerg): void {
		if (!scout.pos.inRangeTo(this.pos, 3) && !scout.pos.isEdge) {
			scout.goTo(this.pos, {range: 3});
		} else if (scout.pos.isEdge) {
			scout.goTo(this.pos);
		}
	}

	run() {
		for (let scout of this.scouts) {
			if (scout.isIdle) {
				this.handleScout(scout);
			}
			scout.run();
		}
	}
}
