// import {Directive} from '../Directive';
// import {profile} from '../../profiler/decorator';
// import {HealPointOverlord} from '../../overlords/offense/healPoint';
// import {Visualizer} from '../../visuals/Visualizer';
//
// @profile
// export class DirectiveHealPoint extends Directive {
//
// 	static directiveName = 'healPoint';
// 	static color = COLOR_RED;
// 	static secondaryColor = COLOR_GREEN;
//
// 	constructor(flag: Flag) {
// 		super(flag);
// 	}
//
// 	spawnMoarOverlords() {
// 		this.overlords.healer = new HealPointOverlord(this);
// 	}
//
// 	init(): void {
//
// 	}
//
// 	run(): void {
// 		// Directive is removed by parent directive; no action needed
// 	}
//
// 	visuals(): void {
// 		Visualizer.marker(this.pos, {color: 'green'});
// 	}
// }
//
