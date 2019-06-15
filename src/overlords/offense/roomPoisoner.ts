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
	controllerWallSites: ConstructionSite[] | undefined;
	sourcesWallSites: ConstructionSite[] | undefined;

	constructor(directive: DirectivePoisonRoom, priority = OverlordPriority.offense.roomPoisoner) {
		super(directive, 'contaminate', priority);
		this.roomPoisoners = this.zerg(Roles.roomPoisoner);
		this.antiControllers = this.zerg(Roles.claim);

		if(this.room && this.room.controller) {
			this.controllerWallSites = _.filter(this.room.constructionSites,s => 
											this.room && this.room.controller &&
											s.structureType == STRUCTURE_WALL && s.pos.isNearTo(this.room.controller.pos));
			this.sourcesWallSites = _.filter(this.room.constructionSites, s => 
											this.room && this.room.controller &&
											s.structureType == STRUCTURE_WALL && 
											!s.pos.isNearTo(this.room.controller.pos));
		}
	}

	refresh() {
		super.refresh();
		this.controllerWallSites = (this.room && this.room.controller) ? _.filter(this.room.constructionSites,
			s => s.structureType == STRUCTURE_WALL && s.pos.isNearTo(this.room!.controller!.pos)) : undefined;
		this.sourcesWallSites = (this.room && this.room.controller) ? _.filter(this.room.constructionSites,
			s => s.structureType == STRUCTURE_WALL && !s.pos.isNearTo(this.room!.controller!.pos)) : undefined;
	}

	init() {
		const isSafe = this.room && !this.room.dangerousPlayerHostiles.length;
		const isReservedByEnemy = (RoomIntel.roomReservedBy(this.pos.roomName) != MY_USERNAME &&
								   RoomIntel.roomReservationRemaining(this.pos.roomName) > 500);

		// spawn required creeps to contaminate if visible + safe + notRserved + notPoisoned,
		// else spawn reserved is reserved by enemy
		if(this.pos.isVisible && isSafe && !this.initializer.memory.isPoisoned) {
			if(!isReservedByEnemy) {
				if(!(this.room && this.room.my)) this.wishlist(1, Setups.infestors.claim);
				this.wishlist(1, Setups.roomPoisoner);
			} else {
				if(!(this.room && this.room.my)) this.wishlist(1, Setups.infestors.controllerAttacker);	
			}
		}
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
		// always recharge if energy == 0 even in spawn room.
		if (roomPoisoner.carry.energy == 0) {
			roomPoisoner.task = Tasks.recharge();
			return;
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
		} else {
			roomPoisoner.goTo(this.pos, {ensurePath: true, avoidSK: true});
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

		// suspend immediatly to avoid colonization flag, (note: tried it in init() of directive but it missed it by one tick)
		if(antiController.room == this.room && this.room.my) {
			const colonyMemory = Memory.colonies[this.room.name] as ColonyMemory | undefined;
			if (colonyMemory && !colonyMemory.suspend) {
				OvermindConsole.suspendColony(this.room.name);
			}
		}
	}

	run() {
		this.autoRun(this.roomPoisoners, roomPoisoner => this.handleRoomPoisoner(roomPoisoner));
		this.autoRun(this.antiControllers, antiController => this.handleAntiController(antiController));
	}
}

