import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Roles, Setups} from '../../creepSetups/setups';
import {$} from '../../caching/GlobalCache';
import {Pathing} from '../../movement/Pathing';

/**
 * Claim an unowned room
 */
@profile
export class ClaimingOverlord extends Overlord {

	claimers: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.colonization.claim) {
		super(directive, 'claim', priority);
		this.claimers = this.zerg(Roles.claim);
	}

	init() {
		let amount = $.number(this, 'claimerAmount', () => {
			if (this.room) { // if you have vision
				if (this.room.my) { // already claimed
					return 0;
				} else { // don't ask for claimers if you can't reach controller
					let pathablePos = this.room.creeps[0] ? this.room.creeps[0].pos
														  : Pathing.findPathablePosition(this.room.name);
					if (!Pathing.isReachable(pathablePos, this.room.controller!.pos,
											 _.filter(this.room.structures, s => !s.isWalkable))) {
						return 0;
					}
				}
			}
			return 1; // otherwise ask for 1 claimer
		});
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
			claimer.goTo(this.pos, {ensurePath: true, avoidSK: true});
		}
	}

	run() {
		this.autoRun(this.claimers, claimer => this.handleClaimer(claimer));
	}
}
