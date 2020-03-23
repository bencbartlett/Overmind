import {Colony} from '../../Colony';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {Directive} from '../../directives/Directive';
import {DirectivePortalScout} from '../../directives/situational/portalScout';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

const DEFAULT_NUM_SCOUTS = 3;

/**
 * Sends out scouts which randomly traverse rooms to uncover possible expansion locations and gather intel
 */
@profile
export class PortalScoutOverlord extends Overlord {

	scouts: Zerg[];
	directive: DirectivePortalScout;
	waypointNames: string[];
	waypoints: RoomPosition[];

	constructor(directive: DirectivePortalScout, priority = OverlordPriority.scouting.randomWalker) {
		super(directive, 'scout', priority);
		this.directive = directive;
		this.waypointNames = ['wp1'];
		this.scouts = this.zerg(Roles.scout, {notifyWhenAttacked: false});
	}

	init() {
		this.wishlist(6, Setups.scout);
	}

	private createWaypoints(): RoomPosition[] {
		this.waypoints = _.map(this.waypointNames, name => Game.flags[name].pos);
		return this.waypoints;
	}

	private portalSays(creep: Zerg, isPublic: boolean) {
		const says = ['One small', 'step for', `${creep.name}`, `one giant`, `leap for`, `all`, `Creepkind`];
		creep.say(says[Game.time % says.length], isPublic);
	}

	private handleScout(scout: Zerg) {
		// Go to the thing. Wild, I know.
		const waypoints = this.createWaypoints();
		const finalDestination = this.directive;
		log.alert(`Portal walker ${scout.print} is in ${scout.room.name}`);
		if (scout.pos != finalDestination.pos) {
			scout.goTo(finalDestination, {avoidSK: true, waypoints: waypoints});
		}
		this.portalSays(scout, true);
	}

	run() {
		this.autoRun(this.scouts, scout => this.handleScout(scout));
	}
}
