import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {Pathing} from '../../movement/Pathing';
import {DirectivePoisonRoom} from '../../directives/offense/poisonRoom';
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
		super(directive, 'contaminate', priority);
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

	private findStructureBlockingController(roomPoisoner: Zerg): Structure | undefined {
		const blockingPos = Pathing.findBlockingPos(roomPoisoner.pos, roomPoisoner.room.controller!.pos,
													_.filter(roomPoisoner.room.structures, s => !s.isWalkable));
		if (blockingPos) {
			const structure = blockingPos.lookFor(LOOK_STRUCTURES)[0];
			if (structure) {
				return structure;
			} else {
				log.error(`${this.print}: no structure at blocking pos ${blockingPos.print}! (Why?)`);
			}
		}
	}

	private handleRoomPoisoner(roomPoisoner: Zerg): void {
		// Ensure you are in the assigned room
		if (roomPoisoner.room == this.room && !roomPoisoner.pos.isEdge) {
			//corner case: unclaimed controller blocked, while sources not 100% bloked
			if(!this.room.my && this.sourcesWallSites && this.controllerWallSites &&
				this.controllerWallSites.length ==0 &&  this.sourcesWallSites.length > 0){
				
				const dismantleTarget = this.findStructureBlockingController(roomPoisoner);
				if (dismantleTarget) {
					roomPoisoner.task = Tasks.dismantle(dismantleTarget);
					return;
				}	
			}


			// recharge
			if (roomPoisoner.carry.energy == 0) {
				roomPoisoner.task = Tasks.recharge();
			} else if (this.room && this.room.controller &&
					   (this.room.controller.level < 2) &&
					   !(this.room.controller.upgradeBlocked > 0)) {
				// upgrade controller to level 2 to unlock walls
				roomPoisoner.task = Tasks.upgrade(this.room.controller);
			} else if (this.controllerWallSites && this.controllerWallSites.length) {
				roomPoisoner.task = Tasks.build(this.controllerWallSites[0]);
			} else if (this.sourcesWallSites && this.sourcesWallSites.length) {
				roomPoisoner.task = Tasks.build(this.sourcesWallSites[0]);
			}
		} else {
			roomPoisoner.goTo(this.pos, {ensurePath: true, avoidSK: true});
		}
	}

	run() {
		this.autoRun(this.roomPoisoners, roomPoisoner => this.handleRoomPoisoner(roomPoisoner));
	}
}

