import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';

@profile
export class DirectiveRPBunker extends Directive {

	static directiveName = 'roomPlanner:CommandCenter';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_RED;

	constructor(flag: Flag) {
		super(flag);
	}

	init(): void {
		this.colony.roomPlanner.addComponent('bunker', this.pos, this.memory.rotation);
	}

	run(): void {

	}
}

