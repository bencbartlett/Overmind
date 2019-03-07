import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {SourceReaperOverlord} from '../../overlords/mining/sourceKeeperReeper';


/**
 * Remote mining directive for source keeper rooms
 */
@profile
export class DirectiveSKOutpost extends Directive {

	static directiveName = 'outpostSK';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_YELLOW;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 7);
	}

	spawnMoarOverlords() {
		this.overlords.sourceReaper = new SourceReaperOverlord(this);
	}

	init(): void {

	}

	run(): void {

	}
}

