import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';

@profile
export class DirectiveRPHatchery extends Directive {

	static directiveName = 'roomPlanner:Hatchery';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_GREEN;

	constructor(flag: Flag) {
		super(flag);
	}

	init(): void {
		this.colony.roomPlanner.addComponent('hatchery', this.pos, this.memory.rotation);
	}

	run(): void {

	}
}

