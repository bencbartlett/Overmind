import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';

/**
 * [DEPRECATED] Place a command center at the target location
 */
@profile
export class DirectiveRPCommandCenter extends Directive {

	static directiveName = 'roomPlanner:CommandCenter';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_BLUE;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {

	}

	init(): void {
		log.info(`Classic overmind layout is deprecated; bunker layout is recommended.`);
		this.colony.roomPlanner.addComponent('commandCenter', this.pos, this.memory.rotation);
	}

	run(): void {

	}
}

