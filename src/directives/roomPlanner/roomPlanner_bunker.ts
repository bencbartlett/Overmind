import {profile} from '../../profiler/decorator';
import {bunkerLayout} from '../../roomPlanner/layouts/bunker';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

/**
 * Manually place a bunker anchored at the target location for the RoomPlanner to use in semiautomatic or manual mode
 */
@profile
export class DirectiveRPBunker extends Directive {

	static directiveName = 'roomPlanner:CommandCenter';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_RED;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {

	}

	init(): void {
		this.colony.roomPlanner.addComponent('bunker', this.pos, this.memory.rotation);
	}

	run(): void {

	}

	visuals(): void {
		Visualizer.drawLayout(bunkerLayout, this.pos);
	}
}

