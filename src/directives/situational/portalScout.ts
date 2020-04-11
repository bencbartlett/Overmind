import {log} from '../../console/log';
import {PortalScoutOverlord} from '../../overlords/scouting/portalWalker';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';

/**
 * It's like the movie Interstellar, but the special effects budget is whatever cash I left in my jeans
 */
@profile
export class DirectivePortalScout extends Directive {

	static directiveName = 'portalScout';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_WHITE;

	static requiredRCL = 3;

	spawnMoarOverlords() {
		this.overlords.portalScoutOverlord = new PortalScoutOverlord(this);
	}

	init(): void {

	}

	run(): void {
		log.alert(`Running portal scout ${this.print}`);
	}
}
