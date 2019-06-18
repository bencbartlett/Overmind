import {ColonyMemory} from '../../Colony';
import {OvermindConsole} from '../../console/Console';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectivePoisonRoom} from '../../directives/offense/poisonRoom';
import {RoomIntel} from '../../intel/RoomIntel';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {printRoomName} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {MY_USERNAME} from '../../~settings';
import {Overlord} from '../Overlord';


/**
 * Spawn roomPoisoner - upgrqde controller to lvl2, wall in controller then sources.
 */
@profile
export class RoomPoisonerOverlord extends Overlord {

	roomPoisoners: Zerg[];
	antiControllers: Zerg[]; // claim and counter reserve if required

	WallCSitesController: ConstructionSite[] | undefined;
	WallCSitesSources: ConstructionSite[] | undefined;
	WalkableControllerPOS: RoomPosition[] | undefined;
	WalkableSourcesPOS: RoomPosition[] | undefined;

	constructor(directive: DirectivePoisonRoom, priority = OverlordPriority.offense.roomPoisoner) {
		super(directive, 'contaminate', priority);
		this.roomPoisoners = this.zerg(Roles.roomPoisoner);
		this.antiControllers = this.zerg(Roles.claim);	
	}

	refresh() {
		super.refresh();
	}

	init() {
		
		// Do not start poison operation if room is not visible or has dangerous hostiles.
		if(!this.pos.isVisible || (this.room && this.room.dangerousPlayerHostiles.length > 0)) {
			return;
		}

		const isReservedByEnemy = (RoomIntel.roomReservedBy(this.pos.roomName) != MY_USERNAME &&
								   RoomIntel.roomReservationRemaining(this.pos.roomName) > 500);

		if(isReservedByEnemy) { // cancel enemy reservation with controllerAttacker.
			this.wishlist(1, Setups.infestors.controllerAttacker);	
		} else { // if not reserved, then start poison operation, and claim if not room.my
			this.wishlist(1, Setups.roomPoisoner); 
			if(this.room && !this.room.my) this.wishlist(1, Setups.infestors.claim);
		}

		// Prepare room for poisoning before running creep logic
		if(Game.time % 25 == 0 && this.room && this.room.my && this.room.controller!.level == 1) {
			if(this.room.hostiles.length > 0) {
				log.warning(`room ${this.print}: ${printRoomName(this.pos.roomName)}
							 poisoning directive can't destory/remove structures/csites due to hostiles presense`);
			} else {
				if(this.room.containers.length > 0) { // remove any containers that can be next to sources
					_.forEach(this.room.containers, container => {container.destroy();});
				}
				// remove all walls
				if(this.room.walls.length) {
					_.forEach(this.room.walls, wall => {wall.destroy();});
				}
				// remove any hostile construction sites
				_.forEach(this.room.find(FIND_HOSTILE_CONSTRUCTION_SITES), csite => {csite.remove();});
			}
		}			

	}

		
		
	

	private handleRoomPoisoner(roomPoisoner: Zerg): void {

		// TODO:
		/*
			anything related to room poisoning from walls to csites...etc 
			to be done by roomPoisoner
			because, it runs only when it is in room && room.my and RCL >=2
			after it has charged...etc.
			just create a poison function and call it
		*/




		// always recharge if energy == 0 even in spawn room.
		if (roomPoisoner.carry.energy == 0) {
			roomPoisoner.task = Tasks.recharge();
			return;
		}

		if (!(roomPoisoner.room == this.room && !roomPoisoner.pos.isEdge)) {
			roomPoisoner.goTo(this.pos, {ensurePath: true, avoidSK: true});
			return;
		}

		if(!this.room.my) {
			return; // do nothing
		}

		// at this stage, it is in target OWNED room, upgrade if RCL1, Poison if RCL2
		const roomRCL = this.room.controller!.level;
		switch (roomRCL) {
			case 1: {
				roomPoisoner.task = Tasks.upgrade(this.room.controller!);		  
				break;
			}
			default:{
				//repair
				//build
				//if nothing to do, then place csites (poison)// this will ensure that it will executed once.
			}

		}


		// Ensure you are in the assigned room
		if (roomPoisoner.room == this.room && !roomPoisoner.pos.isEdge) {
			// upgrade controller to level 2 to unlock walls			
			if (this.room && this.room.controller && this.room.my &&
					   (this.room.controller.level < 2) &&
					   !(this.room.controller.upgradeBlocked > 0)) {
				roomPoisoner.task = Tasks.upgrade(this.room.controller);
				return;
			} 
			// repair poison walls < 1000 hits, assuming all other wall are destoryed by directive
			const wallsToRepair = _.filter(this.room.walls, wall => wall.hits < 1000);
			if(wallsToRepair.length > 0) {
				const closestWall = roomPoisoner.pos.findClosestByRange(wallsToRepair);
				if(closestWall) {
					roomPoisoner.task = Tasks.repair(closestWall);
					return;
				}
			}
			// build wall csites for controller then sources.
			if(this.controllerWallSites) {
				const controllerWallSite = _.first(this.controllerWallSites); 
				if (controllerWallSite) {
					roomPoisoner.task = Tasks.build(controllerWallSite);
					return;
				}
			}	

			if (this.sourcesWallSites) {
				const sourcesWallSite = _.first(this.sourcesWallSites);
				if(sourcesWallSite) {
					roomPoisoner.task = Tasks.build(sourcesWallSite);
					return;
				}
			} 

			
		}
	}

	private handleAntiController(antiController: Zerg): void {					
		if (antiController.room == this.room && !antiController.pos.isEdge) {
			// go near controller
			if(!antiController.pos.isNearTo(this.room.controller!)) {
				antiController.goTo(this.room.controller!);
				return;
			}

			// kill claimer if room claimed, it can be blocking wall csite creation
			if (this.room.my && this.room!.controller!.level == 2) {
				antiController.suicide();
				return;
			}
			// counter reserve controller if reserved by enemy. else, claim it
			if (this.room && this.room.controller && this.room.controller.reservation && 
				this.room.controller.reservation.username != MY_USERNAME) {
				antiController.attackController(this.room.controller);
				return;
			} else if (this.room && !this.room.my) {
				antiController.task = Tasks.claim(this.room.controller!);
				return;
			}
		} else {
			// Go to target room.
			antiController.goTo(this.pos);
		}

		/*
		if(antiController.room == this.room && this.room.my) {
			const colonyMemory = Memory.colonies[this.room.name] as ColonyMemory | undefined;
			if (colonyMemory && !colonyMemory.suspend) {
				OvermindConsole.suspendColony(this.room.name);
			}
		}
		*/
	}

	run() {
		this.autoRun(this.roomPoisoners, roomPoisoner => this.handleRoomPoisoner(roomPoisoner));
		this.autoRun(this.antiControllers, antiController => this.handleAntiController(antiController));
	}
}

