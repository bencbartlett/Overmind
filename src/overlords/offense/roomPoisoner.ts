import {ColonyMemory} from '../../Colony';
import {OvermindConsole} from '../../console/Console';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectivePoisonRoom} from '../../directives/offense/poisonRoom';
import {RoomIntel} from '../../intel/RoomIntel';
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

		if(isReservedByEnemy) { // cancel enemy reservation with controllerAttacker body.
			this.wishlist(1, Setups.infestors.controllerAttacker);	
		} else { // if not reserved, then start poison operation, and claim if not room.my
			this.wishlist(1, Setups.roomPoisoner); 
			if(this.room && !this.room.my) this.wishlist(1, Setups.infestors.claim);
		}

		// Prepare room for poisoning before running creep logic
		if(Game.time % 25 == 0 && this.room && this.room.my && this.room.controller!.level == 1) {
			if(this.room.hostiles.length > 0) {
				log.warning(`room ${this.print}: ${printRoomName(this.pos.roomName)}
							 poisoning directive can't destroy/remove structures/csites due to hostiles presence`);
			} else {
				if(this.room.structures.length > 0) { // clear room of structures
					_.forEach(this.room.structures, structure => {structure.destroy();});
				}
				// remove any hostile construction sites
				_.forEach(this.room.find(FIND_HOSTILE_CONSTRUCTION_SITES), csite => {csite.remove();});
			}
		}			
	}

	private poisonController(): boolean {
		if(!(this.room && this.room.controller)) {
			return false;
		}
		const poisonControllerPOS =  _.filter(this.room.controller.pos.neighbors, pos => pos.isWalkable(true));
		if(poisonControllerPOS.length > 0) {
			_.forEach(poisonControllerPOS,pos=> {pos.createConstructionSite(STRUCTURE_WALL);});
			return true;
		} else {
			return false;
		}
	}
	
	private poisonSources(): boolean {
		if(!(this.room && this.room.controller)) {
			return false;
		}
		const poisonSourcesPOS =  _.filter(_.flatten(_.map(this.room.sources,s=>s.pos.neighbors)),pos =>pos.isWalkable(true));
		if(poisonSourcesPOS.length > 0) {
			_.forEach(poisonSourcesPOS,pos=> {pos.createConstructionSite(STRUCTURE_WALL);});
			return true;
		} else {
			return false;
		}
	}

	private handleRoomPoisoner(roomPoisoner: Zerg): void {
		// always recharge if energy == 0 even in spawn room.
		if (roomPoisoner.carry.energy == 0) {
			roomPoisoner.task = Tasks.recharge();
			return;
		}

		// Goto Target room
		if (!(roomPoisoner.room == this.room && !roomPoisoner.pos.isEdge)) {
			roomPoisoner.goTo(this.pos, {ensurePath: true, avoidSK: true});
			return;
		}

		// in target room, but not claimed yet => do nothing
		if(!this.room.my) {
			return;
		}

		// at this stage, it is in target OWNED room, upgrade if RCL1, Poison if RCL2
		if(this.colony.level == 1 ) {
			roomPoisoner.task = Tasks.upgrade(this.room.controller!);
			return;
		} else { // owned room with RCL > 1, start poison actions
			// 1) Fortify walls < 10000hits
			const wallsToFortify = _.filter(this.room.walls, wall => wall.hits < 10000);
			if(wallsToFortify.length > 0) {
				const closestWall = roomPoisoner.pos.findClosestByRange(wallsToFortify);
				if(closestWall) {
					roomPoisoner.task = Tasks.fortify(closestWall);
					return;
				}
			}
			// 2) Build walls 
			const wallsToBuild = _.filter(this.room.constructionSites,s => s.structureType == STRUCTURE_WALL);
			if(wallsToBuild) {
				const target = _.first(wallsToBuild);
				if (target) {
					roomPoisoner.task = Tasks.build(target);
					return;
				}
			}
			// 3) if no walls to build nor fortify found, then create csite walls around controller FIRST
			if(this.poisonController()) {
				return;
			} 

			// 4) finally, poison sources (create wall csite around them)
			this.poisonSources();
			return;
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

		// Suspend Colony if owned
		// Note: although it is recommended to assign this task to PoisonDirective
		// if not done here after creep claiming the room, the overseer will create a colonization flag in the next tick
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

