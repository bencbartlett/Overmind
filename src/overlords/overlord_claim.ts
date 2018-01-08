import {Overlord} from './Overlord';
import {ClaimerSetup} from '../creepSetup/defaultSetups';
import {TaskClaim} from '../tasks/task_claim';
import {TaskGoTo} from '../tasks/task_goTo';
import {TaskSignController} from '../tasks/task_signController';
import {Priority} from '../config/priorities';

export class ClaimingOverlord extends Overlord {

	claimers: Zerg[];

	constructor(directive: IDirective, priority = Priority.Normal) {
		super(directive, 'claim', priority);
		this.claimers = this.creeps['claimer'];
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
				claimer.task = new TaskClaim(this.room.controller!);
			} else {
				claimer.task = new TaskSignController(this.room.controller!);
			}
		} else {
			claimer.task = new TaskGoTo(this.pos);
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
