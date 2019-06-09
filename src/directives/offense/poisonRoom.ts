import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {RoomPoisonerOverlord} from '../../overlords/offense/roomPoisoner';
import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';
import {Pathing} from '../../movement/Pathing';
import {ReservingOverlord} from '../../overlords/colonization/reserver';
import {OvermindConsole} from '../../console/Console';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';


/**
 * Poison sources in remote rooms by claiming controller, walling in its sources and controller then unclaiming it.
 */
@profile
export class DirectivePoisonRoom extends Directive {
	
	static directiveName = 'PoisonRoom';
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
		reserve: ReservingOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectivePoisonRoom.requiredRCL);
		// Remove if misplaced
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
						`removing directive!`);
			this.remove(true);
		}

		//remove if created in owned room! (fail safe)
		if(this.room && this.room.my && this.room.controller!.level > 2){
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
		//if room is visible + not claimed + GCL not enough, do not spawn claim/roomPoisiner
		if(this.pos.isVisible && this.room && !this.room.my && _.values(Overmind.colonies).length >= Game.gcl.level){
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} not enough GCL to contaminate room;`);
			return;
		}
		//conditions:
		let isSafe = this.room && !this.room.dangerousPlayerHostiles.length;
		let isNotReservedByEnemy = !(this.room && this.room.controller && this.room.controller.reservation && this.room.controller.reservation.ticksToEnd > 500);
		let hasClaimer = (this.overlords.claim.claimers.length || 0);
		let hasRoomPoisoner = (this.overlords.roomPoisoner.roomPoisoners.length || 0);
		let hasScout = (this.overlords.scout.scouts.length || 0);
		let hasReserver = (this.overlords.reserve.reservers.length || 0);

		//spawn required creeps to contaminate if visible + safe + notRserved + notPoisoned, else spawn reserved is reserved by enemy
		if((hasClaimer || hasRoomPoisoner || hasReserver) && (this.pos.isVisible && isSafe && !this.isPoisoned())){
			if(isNotReservedByEnemy){
				if(!(this.room && this.room.my)) this.overlords.claim = new ClaimingOverlord(this);
				this.overlords.roomPoisoner = new RoomPoisonerOverlord(this);
			}else{
				this.overlords.reserve = new ReservingOverlord(this);		
			}
		}
		//spawn stationary scout if not visible nor claimed
		if( !(this.room && this.room.my) && ((hasScout || !this.pos.isVisible))){
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
		//NOTE: allowUnowned flag in findBestStructureTargetInRange for autoMele and autoRanged (combatZerg.ts) is set to false
		//		this is to prevent melee/ranged defences from destoying constucuted walls.
		if(this.room && this.room.playerHostiles.length > 0 && !this.isPoisoned()){	
			DirectiveInvasionDefense.createIfNotPresent(Pathing.findPathablePosition(this.room.name),'room');
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
					//suspend the colony to prevent colonization/harvest flags
					OvermindConsole.suspendColony(this.room.name);

					//kill claimer if room claimed, it can be blocking wall csite creation
					if (this.overlords.claim.claimers && this.overlords.claim.claimers.length){
						this.overlords.claim.claimers[0].suicide();
					}
					//remove any containers that can be next to sources
					if(this.room.hostiles.length){
						log.warning(`room ${this.print}: ${printRoomName(this.pos.roomName)} poisoning directive can't destory/remove structures/csites due to hostiles presense`);
					} else {
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
				}
				default:{
					if(this.isPoisoned()){
						//remove roads before unclaiming (if there are no hostiles to prevent it)
						if(!this.room.hostiles.length && this.room.roads.length > 0){
							_.forEach(this.room.roads, road => {road.destroy();} );
						}
						
						//clear unsuspend colony flag, then unclaim room
						OvermindConsole.unsuspendColony(this.room.name);
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





