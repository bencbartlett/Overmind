import {Directive} from './Directive';
import {profile} from '../lib/Profiler';
import {ReservingOverlord} from '../overlords/overlord_reserve';

@profile
export class DirectiveOutpost extends Directive {

	static directiveName = 'outpost';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_PURPLE;

	constructor(flag: Flag) {
		super(flag);
		this.overlords.reserve = new ReservingOverlord(this);
	}

	init(): void {

	}

	run(): void {

	}
}

