import {Directive} from './Directive';
import {profile} from '../lib/Profiler';

@profile
export class DirectiveRPUpgradeSite extends Directive {

	static directiveName = 'roomPlanner:UpgradeSite';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_PURPLE;

	constructor(flag: Flag) {
		super(flag);
	}

	init(): void {
		this.colony.roomPlanner.addComponent('upgradeSite', this.pos, this.memory.rotation);
	}

	run(): void {

	}
}

