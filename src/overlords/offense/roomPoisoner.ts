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
			this.wishlist(2, Setups.roomPoisoner);
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

		// fortify walls.hits < MINIMUM_WALL_HITS as a priority
		// Note: do not use cached room.walls
		const walls = this.room!.find(FIND_STRUCTURES, {
			 					 filter: (s: Structure) => s.structureType == STRUCTURE_WALL &&
			 								  			   s.hits < MINIMUM_WALL_HITS});
		const wallsToFortify = _.filter(walls, wall => wall.hits == 1) as StructureWall[];
		const targetWall	 = _.first(wallsToFortify);
		if(targetWall) {
			roomPoisoner.task = Tasks.fortify(targetWall);
			return;
		}

		// construct walls
		// Note: directive will take care of managing the csites, so just build on sight!
		// Note: do not use cached room.constructionSites, get a fresh list
		const csites = this.room!.find(FIND_CONSTRUCTION_SITES);
		if(this.room && csites.length > 0) {
			roomPoisoner.task = Tasks.build(_.first(csites));
			return;
		}

		// if nothing to do, then move away from csite location if any.
		if(this.room && this.room.controller) {
			if(roomPoisoner.pos.isNearTo(this.room.controller)) {
				roomPoisoner.creep.moveTo(this.room.mineral!);
				return;
			}
			_.forEach(this.room.sources,source => {
				if(roomPoisoner.pos.isNearTo(source)) {
					roomPoisoner.creep.moveTo(this.room!.mineral!);
					return;
				}
			});
		}
		// if nothing to do, then say something
		roomPoisoner.say('something!');
	}
	run() {
		this.autoRun(this.roomPoisoners, roomPoisoner => this.handleRoomPoisoner(roomPoisoner));
	}
}
