import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {RoomPoisonerOverlord} from '../../overlords/offense/roomPoisoner';
import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';
import {OvermindConsole} from '../../console/Console';
import {OutpostDefenseOverlord} from '../../overlords/defense/outpostDefense';
import {ColonyMemory} from '../../Colony';

interface DirectivePoisonRoomMemory extends FlagMemory {
	poisonSourcesOnly: boolean;
	removeIfPoisoned: boolean;
	isPoisoned: boolean;
	isHostile: boolean;

	//the below are not used, but required for OutpostDefenseOverlord
	persistent?: boolean;
	created: number;
	safeSince: number;
}

/**
 * Poison sources in remote rooms by claiming controller, walling in its sources and controller then unclaiming it.
 */
@profile
export class DirectivePoisonRoom extends Directive {
	
	static directiveName = 'PoisonRoom';
	static color = COLOR_RED;
	static secondaryColor = COLOR_BROWN;
	static requiredRCL = 4;
	
	memory: DirectivePoisonRoomMemory;

	walkableSourcePosisions: RoomPosition[];
	walkableControllerPosisions: RoomPosition[];

	overlords: {
		roomPoisoner: RoomPoisonerOverlord;
		scout: StationaryScoutOverlord;
		defenders: OutpostDefenseOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectivePoisonRoom.requiredRCL);

		this.memory.poisonSourcesOnly = false;
		this.memory.removeIfPoisoned = true;
		this.memory.isPoisoned = this.isPoisoned();
		this.memory.isHostile = (this.room && this.room.hostiles.length > 0)? true:false;

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
		if (this.memory.removeIfPoisoned && this.isPoisoned()) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is already contaminated; ` +
						`removing directive!`);
			this.remove(true);
		}
		
	}

	spawnMoarOverlords() {
		//if room is visible + not claimed + GCL not enough, do not spawn roomPoisiner
		if(this.pos.isVisible && this.room && !this.room.my && _.values(Overmind.colonies).length >= Game.gcl.level){
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} not enough GCL to contaminate room;`);
			return;
		}
		if((this.room && this.room.hostiles.length > 0) || this.memory.isHostile){
			this.memory.isHostile = true; //once hostile, always hostile, do not send scouts and always send defenders
			this.overlords.defenders = new OutpostDefenseOverlord(this);
		} else{
			this.overlords.scout = new StationaryScoutOverlord(this);
		}
		this.overlords.roomPoisoner = new RoomPoisonerOverlord(this);
	}

	init() {
		this.alert(`Poisoning Room ${this.pos.roomName}`);
		//suspend the colony to prevent colonization/harvest flags
		if(this.room && this.room.my){
			const colonyMemory = Memory.colonies[this.room.name] as ColonyMemory | undefined;
			if (colonyMemory && !colonyMemory.suspend) {
				OvermindConsole.suspendColony(this.room.name);
			}
		}

		//calculate wall positions
		if(this.room && this.room.controller){
			this.walkableSourcePosisions = _.filter(_.flatten(_.map(this.room.sources, s => s.pos.neighbors)),pos => pos.isWalkable(true));
			this.walkableControllerPosisions =  _.filter(this.room.controller!.pos.neighbors, pos => pos.isWalkable(true));
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
			if(!this.memory.poisonSourcesOnly && this.walkableControllerPosisions.length){
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
			if(!this.memory.poisonSourcesOnly){
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
						if(this.memory.removeIfPoisoned){
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





