import {Directive} from './Directive';
import {profile} from '../lib/Profiler';

@profile
export class DirectiveRPMiningGroup extends Directive {

	static directiveName = 'roomPlanner:MiningGroup';
	static color = COLOR_WHITE;
	static secondaryColor = COLOR_YELLOW;

	constructor(flag: Flag) {
		super(flag);
	}

	init(): void {

	}

	run(): void {

	}
}

