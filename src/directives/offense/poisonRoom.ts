import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {RoomPoisonerOverlord} from '../../overlords/offense/roomPoisoner';
import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';
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
	static removeIfPoisoned = true;
	
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

		//remove if created in owned room!
		if(this.room && this.room.my){
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} can not contaminate owned room; ` +
			`manually unclaim it  first if you still want to contaminate it!`);
			this.remove(true);
		}
		
		// remove if already contaminated (if visible)
		if (DirectivePoisonRoom.removeIfPoisoned && this.isPoisoned()) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is already contaminated; ` +
						`removing directive!`);
			this.remove(true);
		}
		
	}

	

	spawnMoarOverlords() {
		//conditions:
		let isSafe = this.room && !this.room.dangerousPlayerHostiles.length;
		let isNotReserved = !(this.room && this.room.controller && this.room.controller.reservation && this.room.controller.reservation.ticksToEnd > 500);

		//spawn required creeps to contaminate if visible + safe + notRserved + notPoisoned
		if(this.pos.isVisible && isSafe && isNotReserved && !this.isPoisoned){
			this.overlords.claim = new ClaimingOverlord(this);
			this.overlords.roomPoisoner = new RoomPoisonerOverlord(this);	
		}
		//spawn stationary scout if not visible
		if(!this.pos.isVisible){ //if not visible, send a scout
			this.overlords.scout = new StationaryScoutOverlord(this);	
		}
	}

	init() {
		this.alert(`Poisoning Room ${this.pos.roomName}`);

		//calculate wall positions
		if(this.room && this.room.controller){
			this.walkableSourcePosisions = _.filter(_.flatten(_.map(this.room.sources, s => s.pos.neighbors)),pos => pos.isWalkable(true));
			this.walkableControllerPosisions =  _.filter(this.room.controller!.pos.neighbors, pos => pos.isWalkable(true));
		}

		//enemy creeps can block/attack operation, create OutpostDefense Directive to kill them
		//NOTE: allowUnowned flag in findBestStructureTargetInRange for autoMele and autoRanged (combatZerg.ts) is set to true
		//		this is to prevent melee/ranged defences from destoying constucuted walls.
		if(this.room && this.room.playerHostiles.length > 0 && !this.isPoisoned()){	
			DirectiveOutpostDefense.createIfNotPresent(new RoomPosition(25,25,this.room.name),'room');
		}
	}

	private poison() {
		//poison actions (creating wall csites are only done when roomPoisoner creep is present with > 0 energy)
		let roomPoisoner = (!!this.overlords.roomPoisoner.roomPoisoners.length) ? this.overlords.roomPoisoner.roomPoisoners[0] : undefined;
		if(roomPoisoner && roomPoisoner.carry.energy > 0){
			//wall in sources
			if(this.walkableSourcePosisions.length){
				_.forEach(this.walkableSourcePosisions,pos=>{pos.createConstructionSite(STRUCTURE_WALL)});
			}
			//wall in controller, if option is selected
			if(!DirectivePoisonRoom.poisonSourcesOnly && this.walkableControllerPosisions.length){
				_.forEach(this.walkableControllerPosisions,pos=>{pos.createConstructionSite(STRUCTURE_WALL)});
			}
		} else {
			//if creep does not exist or .carry == 0, just remove the wall csite, they are not walkable and can block harvesting 
			_.forEach(this.room!.constructionSites, csite => {csite.remove();} );
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
		if(Game.time % 25 == 0 && this.room && this.room.my){ //if visible and owned room
			const roomRCL = this.room.controller!.level;
			switch(roomRCL){
				case 1:{
					//kill claimer if room claimed, it can be blocking wall csite creation
					if (this.overlords.claim.claimers && this.overlords.claim.claimers.length){
						this.overlords.claim.claimers[0].suicide();
					}
					//remove any containers that can be next to sources
					if(this.room.containers.length){
						_.forEach(this.room.containers, container => {container.destroy();});
					}
					//remove all wall (will keep all poisno walls in RCL2need
					if(this.room.walls.length){
						_.forEach(this.room.walls, wall => {wall.destroy();});
					}
					//remove any hostile consituction sites
					_.forEach(this.room.find(FIND_HOSTILE_CONSTRUCTION_SITES), csite => {csite.remove();});
				}
				default:{
					if(this.isPoisoned()){
						//remove roads before unclaiming
						if(this.room.roads.length > 0){
							_.forEach(this.room.roads, road => {road.destroy();} );
						}
						
						this.room.controller!.unclaim();
						
						//remove direcitve if done, or keep it for constant harassement
						if(DirectivePoisonRoom.removeIfPoisoned){
							log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: operation completed.`);
							this.remove();
						}
					} else {
						this.poison();
					}
				}

			}
		}

		// Remove if owned by other player
		if (Game.time % 10 == 2 && this.room && !!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
	}
}





