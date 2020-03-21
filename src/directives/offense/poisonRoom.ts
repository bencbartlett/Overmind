import {Colony, ColonyMemory, getAllColonies} from '../../Colony';
import {log} from '../../console/log';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {RoomPoisonerOverlord} from '../../overlords/offense/roomPoisoner';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {DirectiveOutpostDefense} from '../defense/outpostDefense';
import {Directive} from '../Directive';
import {DirectiveControllerAttack} from './controllerAttack';

export const RUN_TIMER = 25;

/*
* Poison sources in remote rooms by claiming controller, walling in its sources and controller then unclaiming it.
*/
@profile
export class DirectivePoisonRoom extends Directive {
	static directiveName = 'PoisonRoom';
	static color = COLOR_RED;
	static secondaryColor = COLOR_BROWN;
	static requiredRCL = 4;
	walkableSourcePosisions: RoomPosition[];
	walkableControllerPosisions: RoomPosition[];
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
		// Remove if not enough GCL
		if(getAllColonies().length == Game.gcl.level) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} not enough GCL; ` +
						`for poison room, removing directive!`);
		}
	}
	spawnMoarOverlords() {
		this.overlords.claim = new ClaimingOverlord(this);
		this.overlords.roomPoisoner = new RoomPoisonerOverlord(this);
	}
	init() {
		this.alert(`Poisoning Room ${this.pos.roomName}`);

		if(!(this.room && this.room.controller)) {
			return;
		}

		// suspend room immediately once claimed to avoid default room actions
		if(this.room.controller.level == 1) {
			this.suspendColony(this.room.name);
		}

		if (Game.time % RUN_TIMER == 0) {
			// capture variables
			this.walkableSourcePosisions	 = _.filter(_.flatten(_.map(this.room.sources,
													s => s.pos.neighbors)),pos => pos.isWalkable(true));
			this.walkableControllerPosisions =  _.filter(this.room.controller!.pos.neighbors,
													pos => pos.isWalkable(true));
			
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
	private suspendColony(roomName: string): string {
		if (Overmind.colonies[roomName]) {
			const colonyMemory = Memory.colonies[roomName] as ColonyMemory | undefined;
			if (colonyMemory) {
				colonyMemory.suspend = true;
				Overmind.shouldBuild = true;
				return `Colony ${roomName} suspended.`;
			} else {
				return `No colony memory for ${roomName}!`;
			}
		} else {
			return `Colony ${roomName} is not a valid colony!`;
		}
	}

	private poisonActions() {
		if(!(this.room && this.room.controller && this.room.controller.level == 2 && 
			 this.walkableControllerPosisions && this.walkableControllerPosisions)) {
			return;
		}

		// Poison Controller First
		if(this.walkableControllerPosisions.length > 0) {
			_.first(this.walkableControllerPosisions).createConstructionSite(STRUCTURE_WALL);
			return;
		} 

		// for sources - place one construction site at a time
		if(this.room.constructionSites.length > 0) {
			return;
		}

		// Poison Sources Next
		// Trick: Csite are not walkable, wait for poisoner to carry energy before blocking Sources
		// Trick: Remove sources Csites if poisoner need to harvest, i.e carrying 0 energy
		if (this.overlords.roomPoisoner.roomPoisoners.length &&
			this.overlords.roomPoisoner.roomPoisoners[0].carry.energy > 0) {
				if(this.walkableSourcePosisions.length) {
					_.first(this.walkableSourcePosisions).createConstructionSite(STRUCTURE_WALL);
				}
		} else {
				_.forEach(this.room.constructionSites, csite => {csite.remove();} );
		}
		
	}
	private isPoisoned(): boolean {
		let result = false;
		if (this.room && this.room.controller!.level > 1) {
			result = !!this.walkableSourcePosisions && !this.walkableSourcePosisions.length &&
					 !!this.walkableControllerPosisions && !this.walkableControllerPosisions.length;
			return result;
		} else {
			return false;
		}
	}

	private prePoisonActions(): void {
		if(!(this.room && this.room.controller && this.room.controller.my)) {
			return;
		}
		// kill claimer if room claimed, it can blocking csite creation
		// it can also be used as a quick energy source from the tomb
		if (this.overlords.claim.claimers.length) {
			this.overlords.claim.claimers[0].suicide();
		}
		// remove any containers that can be next to sources
		if(this.room.containers.length) {
			_.forEach(this.room.containers, container => {container.destroy();});
		}
		// remove any hostile consituction sites
		_.forEach(this.room.find(FIND_HOSTILE_CONSTRUCTION_SITES), csite => {csite.remove();});
	}

	private unclaimActions(): void {
		if(!(this.room && this.room.controller)) {
			return;
		}
		// remove roads before unclaiming
		if(this.room.roads.length > 0) {
			_.forEach(this.room.roads, road => {road.destroy();} );
		}
		this.room.controller.unclaim();
		log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: operation completed.`);
		this.remove();
	}

	run() {
		if (Game.time % RUN_TIMER == 0 && this.room && this.room.controller && this.room.controller.my) {

			// Preperations start at controller level 1
			if(this.room.controller.level == 1) {
				this.prePoisonActions();
				return;
			}
			
			if(this.room.controller.level == 2) {
				if(this.isPoisoned()) {
					this.unclaimActions();
				} else {
					this.poisonActions();
				}
			}
		}		
	}
}
