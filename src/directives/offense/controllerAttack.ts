import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {ControllerAttackerOverlord} from '../../overlords/offense/controllerAttacker';
import {log} from '../../console/log';

export interface DirectiveControllerAttackMemory extends FlagMemory {
	attackPositions: protoPos[];
	readyTick: number;
}

@profile
export class DirectiveControllerAttack extends Directive {

	static directiveName = 'controllerAttack';
	static color = COLOR_RED;
	static secondaryColor = COLOR_PURPLE;

	memory: DirectiveControllerAttackMemory;

	constructor(flag: Flag) {
		super(flag);

		// TODO: Not have a scout at all times
		this.overlords.scout = new StationaryScoutOverlord(this);
		this.overlords.controllerAttack = new ControllerAttackerOverlord(this);
	}

	init(): void {

	}

	run(): void {

	}
}

