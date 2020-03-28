import {getAllColonies} from '../../Colony';
import {OvermindConsole} from '../../console/Console'; // temp for testing
import {log} from '../../console/log';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {RoomPoisonerOverlord} from '../../overlords/colonization/roomPoisoner';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {DirectiveOutpostDefense} from '../defense/outpostDefense';
import {Directive} from '../Directive';
import {DirectiveControllerAttack} from '../offense/controllerAttack';


export const RUN_TIMER = 25;

/*
* Poison sources in remote rooms by claiming controller, walling in its sources and controller then unclaiming it.
*/
@profile
export class DirectivePoisonRoom extends Directive {

	static directiveName = 'PoisonRoom';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_RED;
	static requiredRCL = 4;

	overlords: {
		claim: ClaimingOverlord;
		roomPoisoner: RoomPoisonerOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectivePoisonRoom.requiredRCL);
		// Remove if misplaced
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
						`removing directive!`);
			this.remove(true);
		}
		// failsafe - if already owned and controller level > 2, remove flag
		if(this.room && this.room.controller && this.room.controller.my && this.room.controller.level > 2) {
			this.remove(true);
		}
		// Remove if owned by other player
		if (this.room && !!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove(true);
		}
	}

	get positionsToBlock(): RoomPosition[] {
		if (!this.room) {
			return [];
		}
		const thingsToBlock = _.compact([this.room.controller, ...this.room.sources]) as RoomObject[];
		return  _.unique(_.map(thingsToBlock,obj => obj.pos)).filter(pos => pos.isWalkable); 
	}

	static canAutoPoison(room: Room): boolean {
		return (Memory.settings.autoPoison.enabled && getAllColonies().length == Game.gcl.level &&
				!!room && !!room.controller && room.controller.level == 0 && room.controller.reservation == undefined &&
				room.dangerousHostiles.length == 0 && 
				!room.isOutpost &&
				_.filter(Game.flags, flag => 
					flag.color 			== DirectivePoisonRoom.color && 
					flag.secondaryColor == DirectivePoisonRoom.secondaryColor).length < Memory.settings.autoPoison.concurrent &&
				(_.unique(_.map(_.compact([room.controller, ...room.sources]),
					obj => obj.pos)).filter(pos => pos.isWalkable)).length > 0);
	}

	spawnMoarOverlords() {
		this.overlords.claim = new ClaimingOverlord(this);
		this.overlords.roomPoisoner = new RoomPoisonerOverlord(this);
	}

	init() {
		this.alert(`Poisoning Room ${this.pos.roomName}`);

		// TODO: Muon to add suspension somewhere else after the merge
		// suspend room immediately once claimed to avoid default room actions
		// this is temp for testing the directive
		 if(this.room && this.room.controller && this.room.controller.level == 1) {
			OvermindConsole.suspendColony(this.room.name);
		}

		if (this.room && this.room.controller && (Game.time % RUN_TIMER == 0 || this.room.constructionSites.length == 0)) {
			// reverse reservation if needed
			if(this.room.controller.reservation && this.room.controller.reservation.ticksToEnd > 500) {
				DirectiveControllerAttack.createIfNotPresent(this.room.controller.pos,'room');
			}

			// send fighters if needed
			if(this.room && this.room.playerHostiles.length > 0) {
				DirectiveOutpostDefense.createIfNotPresent(this.room.controller.pos,'room');
			}
		}
	}

	private poisonActions() {
		if(!(this.room && this.room.controller && this.room.controller.level == 2 && this.positionsToBlock.length > 0)) {
			return;
		}

		// Poison blockPositions. One position at a time.
		if(this.positionsToBlock.length > 1) {
			_.first(this.positionsToBlock).createConstructionSite(STRUCTURE_WALL);
		} else { // do not block last position unless poisoner has energy
			if(this.overlords.roomPoisoner.roomPoisoners.length && 
			   this.overlords.roomPoisoner.roomPoisoners[0].carry.energy > 0) {
				_.first(this.positionsToBlock).createConstructionSite(STRUCTURE_WALL);
			}
		}
		
	}

	private prePoisonActions(): void {
		if(!(this.room && this.room.controller && this.room.controller.my)) {
			return;
		}
		// kill claimer if room claimed, it can block csite creation
		// it can also be used as a quick energy source from the tomb
		if (this.overlords.claim.claimers.length) {
			this.overlords.claim.claimers[0].suicide();
		}
		// destroy all structures except for store structures
		this.clearRoom();

		// remove any hostile consituction sites
		_.forEach(this.room.find(FIND_HOSTILE_CONSTRUCTION_SITES), csite => {csite.remove();});
	}

	private unclaimActions(): void {
		if(!(this.room && this.room.controller)) {
			return;
		}
		this.room.controller.unclaim();
		log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: operation completed.`);
		this.remove();
	}

	private clearRoom(): void {
		if (this.room) {
			const allStructures = this.room.find(FIND_STRUCTURES,{
				  filter: (s: Structure) => 
				  		   s.structureType != STRUCTURE_CONTROLLER &&
						   s.structureType != STRUCTURE_STORAGE &&
						   s.structureType != STRUCTURE_TERMINAL &&
						   s.structureType != STRUCTURE_FACTORY &&
						   s.structureType != STRUCTURE_LAB &&
						   s.structureType != STRUCTURE_NUKER
			});
			_.forEach(allStructures,s => s.destroy());
		}
	}

	run() {
		if (this.room && (Game.time % RUN_TIMER == 0 || this.room.constructionSites.length == 0 ) && 
			this.room.controller && this.room.controller.my) {

			// Preperations start at controller level 1
			if(this.room.controller.level == 1) {
				this.prePoisonActions();
				return;
			}
			
			if(this.room.controller.level == 2) {
				if(this.positionsToBlock.length == 0) {
					this.unclaimActions();
				} else {
					this.poisonActions();
				}
			}
		}		
	}
}
