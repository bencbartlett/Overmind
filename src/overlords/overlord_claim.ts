import {Overlord} from './Overlord';
import {ClaimerSetup} from '../creepSetup/defaultSetups';
import {Zerg} from '../Zerg';
import {Tasks} from '../tasks/Tasks';
import {Directive} from '../directives/Directive';
import {OverlordPriority} from './priorities_overlords';

export class ClaimingOverlord extends Overlord {

	claimers: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.realTime.claim) {
		super(directive, 'claim', priority);
		this.claimers = this.creeps('claimer');
	}

	spawn() {
		if (!(this.room && this.room.controller && this.room.controller.my)) {
			this.wishlist(1, new ClaimerSetup());
		} else {
			this.wishlist(0, new ClaimerSetup());
		}
	}

	init() {
		this.spawn();
	}

	private handleClaimer(claimer: Zerg): void {
		if (claimer.room == this.room && !claimer.pos.isEdge) {
			if (this.room.controller!.signedByMe) {
				claimer.task = Tasks.claim(this.room.controller!);
			} else {
				claimer.task = Tasks.signController(this.room.controller!);
			}
		} else {
			claimer.task = Tasks.goTo(this.pos);
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
