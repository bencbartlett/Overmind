import {log} from '../../console/log';
import {LeecherOverlord} from '../../overlords/mining/leecher';
import {profile} from '../../profiler/decorator';
import {Cartographer,ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {Directive} from '../Directive';

/**
 * Leech energy from near by rooms harvested/reserved by enemy players
 */
@profile
export class DirectiveLeech extends Directive {

	static directiveName = 'leech';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_ORANGE;

	constructor(flag: Flag) {
		super(flag);
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			this.remove();
			log.notify(`Removing leech directive in ${this.pos.roomName}: must be a controller room`);
		}
	}

	spawnMoarOverlords() {
		this.overlords.leech = new LeecherOverlord(this);
	}

	init() {
		this.alert(`Leeching room  ${this.pos.roomName}`);
	}

	run() {

	}

}


