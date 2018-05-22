import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {ReservingOverlord} from '../../overlords/colonization/overlord_reserve';
import {ScoutOverlord} from '../../overlords/core/overlord_scout';

@profile
export class DirectiveOutpost extends Directive {

	static directiveName = 'outpost';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_PURPLE;

	static settings = {
		canSpawnReserversAtRCL: 3,
	};

	constructor(flag: Flag) {
		super(flag);
		if (this.colony.level >= DirectiveOutpost.settings.canSpawnReserversAtRCL) {
			this.overlords.reserve = new ReservingOverlord(this);
		} else {
			this.overlords.scout = new ScoutOverlord(this);
		}
	}

	init(): void {

	}

	run(): void {

	}
}

