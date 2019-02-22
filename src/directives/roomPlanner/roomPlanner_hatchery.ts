import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {log} from '../../console/log';

/**
 * [DEPRECATED] Place a hatchery at the target location
 */
@profile
export class DirectiveRPHatchery extends Directive {

	static directiveName = 'roomPlanner:Hatchery';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_GREEN;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {

	}

	init(): void {
		log.info(`Classic overmind layout is deprecated; bunker layout is recommended.`);
		this.colony.roomPlanner.addComponent('hatchery', this.pos, this.memory.rotation);
	}

	run(): void {

	}
}

