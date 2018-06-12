import {Overlord} from '../Overlord';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';

const ClaimerSetup = new CreepSetup('claimer', {
	pattern  : [CLAIM, MOVE],
	sizeLimit: 1
});

@profile
export class ClaimingOverlord extends Overlord {

	claimers: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.realTime.claim) {
		super(directive, 'claim', priority);
		this.claimers = this.creeps(ClaimerSetup.role);
	}

	init() {
		let amount = (this.room && this.room.controller && this.room.controller.my) ? 0 : 1;
		this.wishlist(amount, ClaimerSetup);
	}

	private handleClaimer(claimer: Zerg): void {
		if (claimer.room == this.room && !claimer.pos.isEdge) {
			if (!this.room.controller!.signedByMe) {
				// Takes care of an edge case where planned newbie zone signs prevents signing until room is reserved
				if (!this.room.my && this.room.controller!.signedByScreeps) {
					claimer.task = Tasks.claim(this.room.controller!);
				} else {
					claimer.task = Tasks.signController(this.room.controller!);
				}
			} else {
				claimer.task = Tasks.claim(this.room.controller!);
			}
		} else {
			// claimer.task = Tasks.goTo(this.pos, {travelToOptions: {ensurePath: true}});
			claimer.travelTo(this.pos, {ensurePath: true, preferHighway: true});
		}
	}

	run() {
		for (let claimer of this.claimers) {
			if (claimer.isIdle) {
				this.handleClaimer(claimer);
			}
			claimer.run();
		}
	}
}
