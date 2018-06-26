import {Overlord} from '../Overlord';
import {Zerg} from '../../Zerg';
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
		this.scouts = this.creeps(ScoutSetup.role);
	}

	init() {
		this.wishlist(1, ScoutSetup);
	}

	private handleScout(scout: Zerg): void {
		if (!scout.pos.inRangeTo(this.pos, 3)) {
			// scout.task = Tasks.goTo(this.pos, {moveOptions: {range: 3}});
			scout.goTo(this.pos, {range: 3});
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
