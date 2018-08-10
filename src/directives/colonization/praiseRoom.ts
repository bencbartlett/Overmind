// import {profile} from '../../profiler/decorator';
// import {Directive} from '../Directive';
// import {ClaimingOverlord} from '../../overlords/colonization/claimer';
// import {Colony} from '../../Colony';
//
// @profile
// export class DirectivePraise extends Directive {
//
// 	static directiveName = 'praise';
// 	static color = COLOR_PURPLE;
// 	static secondaryColor = COLOR_YELLOW;
// 	static requiredRCL = 7;
//
// 	incubatee: Colony | undefined; // the colony being incubated by the incubator
//
// 	constructor(flag: Flag) {
// 		super(flag, DirectivePraise.requiredRCL);
// 		// Register incubation status
// 		this.incubatee = this.room ? Overmind.colonies[Overmind.colonyMap[this.room.name]] : undefined;
// 		if (this.incubatee && this.colony != this.incubatee) {
//
// 		}
// 		this.overlords.claim = new ClaimingOverlord(this);
// 	}
//
// 	init() {
//
// 	}
//
// 	run() {
//
// 	}
// }
