import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {RoomPoisonerOverlord} from '../../overlords/offense/roomPoisoner';
import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';
import {DirectiveControllerAttack} from './controllerAttack';
import {DirectiveOutpostDefense} from '../defense/outpostDefense';


/**
 * Poison sources in remote rooms by claiming controller, walling in its sources and controller then unclaiming it.
 */
@profile
export class DirectivePoisonRoom extends Directive {
	
	static directiveName = 'contaminate';
	static color = COLOR_RED;
	static secondaryColor = COLOR_BROWN;
	static requiredRCL = 4;
	static poisonSourcesOnly = false;

	walkableSourcePosisions: RoomPosition[];
	walkableControllerPosisions: RoomPosition[];

	overlords: {
        claim: ClaimingOverlord;
		roomPoisoner: RoomPoisonerOverlord;
		scout: StationaryScoutOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectivePoisonRoom.requiredRCL);
		// Remove if misplaced
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
						`removing directive!`);
			this.remove(true);
		}
		/* commented: keep the directive running for constant checking by stationary scout
		// remove if already contaminated (if visible)
		if (this.isPoisoned()) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is already contaminated; ` +
						`removing directive!`);
			this.remove(true);
		}
		
		// remove if no spare GCL
		if(_.filter(Game.rooms, room => room.my).length == Game.gcl.level){
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} not enough GCL; ` +
						`removing directive!`);
			this.remove(true);
		}
		*/
	}

	spawnMoarOverlords() {
		if(!this.pos.isVisible){
			this.overlords.scout = new StationaryScoutOverlord(this);	
		} else if(this.room && this.room.dangerousPlayerHostiles.length == 0 && !this.isPoisoned()){
			this.overlords.claim = new ClaimingOverlord(this);
			this.overlords.roomPoisoner = new RoomPoisonerOverlord(this);
		}
	}

	init() {
		this.alert(`Poisoning Room ${this.pos.roomName}`);
		if(this.room && this.room.controller){
			this.walkableSourcePosisions = _.filter(_.flatten(_.map(this.room.sources, s => s.pos.neighbors)),pos => pos.isWalkable(true));
			this.walkableControllerPosisions =  _.filter(this.room.controller!.pos.neighbors, pos => pos.isWalkable(true));
		}
		if(this.room && this.room.controller && this.room.controller.reservation && this.room.controller.reservation.ticksToEnd > 500){
			DirectiveControllerAttack.createIfNotPresent(this.room.controller.pos,'room');
		}
		if(this.room && this.room.playerHostiles.length > 0 && !this.isPoisoned()){	
			DirectiveOutpostDefense.createIfNotPresent(new RoomPosition(25,25,this.room.name),'room');
		}
	}

	private poison() {
		if (this.room && this.room.controller!.level > 1) {
			//wall csites are not walkable, block sources only if roomPoisoner.carry.energy > 0
			if (this.overlords.roomPoisoner.roomPoisoners.length && 
				this.overlords.roomPoisoner.roomPoisoners[0].carry.energy > 0){
					//Check for walkable source.pos.neighbors and place wall constuction site
					if(this.walkableSourcePosisions.length){
						_.forEach(this.walkableSourcePosisions,pos=>{pos.createConstructionSite(STRUCTURE_WALL)});
					}
			} else {
				//remove all csites if roomPoisoner.carry.energy == 0, wall csites are not walkable
				if(this.room){
					_.forEach(this.room.constructionSites, csite => {csite.remove();} );
				}
			}
			if(!DirectivePoisonRoom.poisonSourcesOnly){
				//Check for walkable controller.pos.neighbors and place wall constuction site
				if(this.walkableControllerPosisions.length){
					_.forEach(this.walkableControllerPosisions,pos=>{pos.createConstructionSite(STRUCTURE_WALL)});
				}
			}

		}
	}
	private isPoisoned(): boolean {
		let result = false;
		if (this.room && this.room.controller!.level > 1) {
			result = !!this.walkableSourcePosisions && !this.walkableSourcePosisions.length;
			if(!DirectivePoisonRoom.poisonSourcesOnly){
				result = result && !!this.walkableControllerPosisions && !this.walkableControllerPosisions.length;
			}
			return result;
		} else {
			return false;
		}
	}

	run() {
		

		if (Game.time % 25 == 0 && this.room && this.room.my) {

			if(_.filter(Game.rooms, room => room.my).length == Game.gcl.level){
				log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} not enough GCL; ` +
							`for contamination directive!`);
			}

			//kill claimer if room claimed, it is can be blocking wall csite creation
			if (this.overlords.claim.claimers.length){
				this.overlords.claim.claimers[0].suicide();
			}
			//remove any containers that can be next to sources
			if(this.room.containers.length){
				_.forEach(this.room.containers, container => {container.destroy();});
			}

			//remove any hostile consituction sites
			_.forEach(this.room.find(FIND_HOSTILE_CONSTRUCTION_SITES), csite => {csite.remove();});

			if (this.isPoisoned()) {
				//remove roads before unclaiming
				if(this.room.roads.length > 0){
					_.forEach(this.room.roads, road => {road.destroy();} );
				}
				this.room.controller!.unclaim();
				//log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: operation completed.`);
				//this.remove();
			} else {
				this.poison();
			}
		}

		// Remove if owned by other player
		if (Game.time % 10 == 2 && this.room && !!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
	}
}





