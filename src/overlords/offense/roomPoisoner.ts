import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectivePoisonRoom} from '../../directives/offense/poisonRoom';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

/**
 * Spawn roomPoisoner - upgrqde controller to lvl2, wall in controller then sources.
 */
@profile
export class RoomPoisonerOverlord extends Overlord {

	roomPoisoners: Zerg[];
    controllerWallSites: ConstructionSite[] | undefined;
    sourcesWallSites: ConstructionSite[] | undefined;

	constructor(directive: DirectivePoisonRoom, priority = OverlordPriority.offense.roomPoisoner) {
		super(directive, 'roomPoisoner', priority);
		this.roomPoisoners = this.zerg(Roles.roomPoisoner);
		this.controllerWallSites = (this.room && this.room.controller) ? _.filter(this.room.constructionSites,
                                                                    s => s.structureType == STRUCTURE_WALL &&
                                                                    s.pos.isNearTo(this.room!.controller!.pos)) : undefined;
    	this.sourcesWallSites = (this.room && this.room.controller) ? _.filter(this.room.constructionSites,
                                                                    s => s.structureType == STRUCTURE_WALL &&
                                                                    !s.pos.isNearTo(this.room!.controller!.pos)) : undefined;
    }

	refresh() {
		super.refresh();
		this.controllerWallSites = (this.room && this.room.controller) ? _.filter(this.room.constructionSites,
            s => s.structureType == STRUCTURE_WALL &&
            s.pos.isNearTo(this.room!.controller!.pos)) : undefined;
        this.sourcesWallSites = (this.room && this.room.controller) ? _.filter(this.room.constructionSites,
            s => s.structureType == STRUCTURE_WALL &&
            !s.pos.isNearTo(this.room!.controller!.pos)) : undefined;
	}

	init() {
		this.wishlist(1, Setups.roomPoisoner);
	}

	private handleRoomPoisoner(roomPoisoner: Zerg): void {
		// Ensure you are in the assigned room
		if (roomPoisoner.room == this.room && !roomPoisoner.pos.isEdge) {
			// Build and recharge
			if (roomPoisoner.carry.energy == 0) {
                //Csites are not walkable, remove all sources wall csites to avoid being blocked from harvesting sources
                //the direcrive will try recreate them every 25 ticks
                if(this.sourcesWallSites){
                    _.forEach(this.sourcesWallSites, csite => {csite.remove();} );
                }
				roomPoisoner.task = Tasks.recharge();
			} else if (this.room && this.room.controller &&
					   (this.room.controller.level < 2) &&
					   !(this.room.controller.upgradeBlocked > 0)) {
				// upgrade controller to level 2 to unlock walls
				roomPoisoner.task = Tasks.upgrade(this.room.controller);
			} else if (this.controllerWallSites) {
				roomPoisoner.task = Tasks.build(this.controllerWallSites[0]);
			} else if (this.sourcesWallSites) {
				roomPoisoner.task = Tasks.build(this.sourcesWallSites[0]);
			}
		} else {
			// pioneer.task = Tasks.goTo(this.pos);
			roomPoisoner.goTo(this.pos, {ensurePath: true, avoidSK: true});
		}
	}

	run() {
		this.autoRun(this.roomPoisoners, roomPoisoner => this.handleRoomPoisoner(roomPoisoner));
	}
}

