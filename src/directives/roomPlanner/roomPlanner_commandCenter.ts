import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';

@profile
export class DirectiveRPCommandCenter extends Directive {

	static directiveName = 'roomPlanner:CommandCenter';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_BLUE;

	constructor(flag: Flag) {
		super(flag);
	}

	init(): void {
		this.colony.roomPlanner.addComponent('commandCenter', this.pos, this.memory.rotation);
	}

	run(): void {

	}
}

