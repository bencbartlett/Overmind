import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Roles, Setups} from '../../creepSetups/setups';

@profile
export class ClaimingOverlord extends Overlord {

	claimers: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.colonization.claim) {
		super(directive, 'claim', priority);
		this.claimers = this.zerg(Roles.claim);
	}

	init() {
		let amount = (this.room && this.room.controller && this.room.controller.my) ? 0 : 1;
		this.wishlist(amount, Setups.infestors.claim);
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
			// claimer.task = Tasks.goTo(this.pos, {moveOptions: {ensurePath: true}});
			claimer.goTo(this.pos, {ensurePath: true, preferHighway: true});
		}
	}

	run() {
		this.autoRun(this.claimers, claimer => this.handleClaimer(claimer));
	}
}
