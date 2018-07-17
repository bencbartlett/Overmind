import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {ControllerAttackerOverlord} from '../../overlords/offense/controllerAttacker';

@profile
export class DirectiveControllerAttack extends Directive {

	static directiveName = 'controllerAttack';
	static color = COLOR_RED;
	static secondaryColor = COLOR_PURPLE;

	constructor(flag: Flag) {
		super(flag);
		this.overlords.scout = new StationaryScoutOverlord(this); // TODO: Not have a scout at all times
		this.overlords.controllerAttack = new ControllerAttackerOverlord(this);
	}

	init(): void {

	}

	run(): void {

	}
}

