import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectivePortalScout} from '../../directives/situational/portalScout';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

const DEFAULT_NUM_SCOUTS = 2;

/**
 * Sends out scouts which randomly traverse rooms to uncover possible expansion locations and gather intel
 */
@profile
export class PortalScoutOverlord extends Overlord {

	scouts: Zerg[];
	directive: DirectivePortalScout;
	waypoints: RoomPosition[];

	constructor(directive: DirectivePortalScout, priority = OverlordPriority.scouting.randomWalker) {
		super(directive, 'scout', priority);
		this.directive = directive;
		this.scouts = this.zerg(Roles.scout, {notifyWhenAttacked: false});
	}

	init() {
		this.wishlist(DEFAULT_NUM_SCOUTS, Setups.scout);
	}

	private portalSays(creep: Zerg, isPublic: boolean) {
		const says = ['One small', 'step for', `${creep.name}`, `one giant`, `leap for`, `all`, `Creepkind`];
		creep.say(says[Game.time % says.length], isPublic);
	}

	private handleScout(scout: Zerg) {
		const finalDestination = this.directive;
		// log.alert(`Portal walker ${scout.print} is in ${scout.room.name}`);
		if (scout.pos != finalDestination.pos) {
			scout.goTo(finalDestination, {pathOpts: {avoidSK: true}});
		}
		this.portalSays(scout, true);
	}

	run() {
		this.autoRun(this.scouts, scout => this.handleScout(scout));
	}
}
