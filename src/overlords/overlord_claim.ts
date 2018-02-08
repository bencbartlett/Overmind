import {Overlord} from './Overlord';
import {ClaimerSetup} from '../creepSetup/defaultSetups';
import {Priority} from '../config/priorities';
import {Zerg} from '../Zerg';
import {Tasks} from '../tasks/Tasks';
import {Directive} from '../directives/Directive';

export class ClaimingOverlord extends Overlord {

	claimers: Zerg[];

	constructor(directive: Directive, priority = Priority.NormalHigh) {
		super(directive, 'claim', priority);
		this.claimers = this.creeps('claimer');
	}

	spawn() {
		if (!(this.room && this.room.controller && this.room.controller.my)) {
			this.wishlist(1, new ClaimerSetup());
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
