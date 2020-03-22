import {Roles, Setups} from '../../creepSetups/setups';
import {DirectivePoisonRoom} from '../../directives/offense/poisonRoom';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

export const MINIMUM_WALL_HITS = 10000;

/**
 * Spawn roomPoisoner - upgrqde controller to lvl2, wall in controller then sources.
 */
@profile
export class RoomPoisonerOverlord extends Overlord {

	directive: DirectivePoisonRoom;
	roomPoisoners: Zerg[];

	constructor(directive: DirectivePoisonRoom, priority = OverlordPriority.offense.roomPoisoner) {
		super(directive, 'PoisonRoom', priority);

		this.directive = directive;
		this.roomPoisoners = this.zerg(Roles.roomPoisoner);
	}

	init() {
		if(this.room && this.room.dangerousPlayerHostiles.length == 0) {
			this.wishlist(1, Setups.roomPoisoner);
		}
	}
	
	private handleRoomPoisoner(roomPoisoner: Zerg): void {
		// Recharge from colony room.
		if(roomPoisoner.inSameRoomAs(this.colony) && roomPoisoner.carry.energy == 0) {
			roomPoisoner.task = Tasks.recharge();
			return;
		}
		// Go to Target Room
		if (!roomPoisoner.inSameRoomAs(this.directive)) {
			roomPoisoner.goTo(this.pos, {ensurePath: true, avoidSK: true});
			return;
		}
		// all actions below are done in target directive room
		// recharge in target room
		if (roomPoisoner.carry.energy == 0) {
			roomPoisoner.task = Tasks.recharge();
			return;
		}

		// upgrade controller to level 2
		if(this.room && this.room.controller && this.room.controller.level < 2) {
			roomPoisoner.task = Tasks.upgrade(this.room.controller);
			return;
		}
		// fortify walls
		const wallsToFortify = _.filter(this.room!.walls, wall => wall.hits < MINIMUM_WALL_HITS);
		const targetWall	 = _.first(wallsToFortify);
		if(targetWall) {
			roomPoisoner.task = Tasks.fortify(targetWall);
			return;
		}

		// construct walls
		// Note: directive will take care of managing the csites, so just build on sight!
		if(this.room && this.room.constructionSites && this.room.constructionSites.length > 0) {
			roomPoisoner.task = Tasks.build(_.first(this.room.constructionSites));
			return;
		}

		// if nothing to do, move away. might need to place a csite on current pos
		roomPoisoner.goTo(this.room!.mineral!, {range: 5});
	}
	run() {
		this.autoRun(this.roomPoisoners, roomPoisoner => this.handleRoomPoisoner(roomPoisoner));
	}
}
