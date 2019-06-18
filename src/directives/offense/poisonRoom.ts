import {ColonyMemory} from '../../Colony';
import {OvermindConsole} from '../../console/Console';
import {log} from '../../console/log';
import {OutpostDefenseOverlord} from '../../overlords/defense/outpostDefense';
import {RoomPoisonerOverlord} from '../../overlords/offense/roomPoisoner';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';

interface DirectivePoisonRoomMemory extends FlagMemory {
	// These are not used but required for OutpostDefenseOverlord
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

	overlords: {
		roomPoisoner: RoomPoisonerOverlord;
		scout: StationaryScoutOverlord;
		defenders: OutpostDefenseOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectivePoisonRoom.requiredRCL);

		// Remove if misplaced
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
						`removing directive!`);
			this.remove(true);
		}

		// remove if created in owned room! (fail safe)
		if(this.room && this.room.my && this.room.controller!.level > 2) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} can not poison owned room; ` +
			`manually unclaim it  first if you still want to poison it!`);
			this.remove(true);
		}
		
		// remove if already poisoned (if visible)
		if (this.isPoisoned()) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is already contaminated; ` +
						`removing directive!`);
			this.remove(true);
		}
		
	}

	spawnMoarOverlords() {
		if((this.room && this.room.hostiles.length > 0) || this.overlords.defenders) {
			this.overlords.defenders = new OutpostDefenseOverlord(this);
		} else {
			this.overlords.scout = new StationaryScoutOverlord(this);
		}
		// if room is visible + not claimed + GCL not enough, do not spawn roomPoisoner
		if(this.pos.isVisible && this.room && !this.room.my && _.values(Overmind.colonies).length >= Game.gcl.level) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} not enough GCL to poison room;`);
		} else {
			this.overlords.roomPoisoner = new RoomPoisonerOverlord(this);
		}
	}

	init() {
		this.alert(`Poisoning Room ${this.pos.roomName}`);
	}
	private isPoisoned(): boolean {
		if(this.room && this.room.controller) {
			const walkableSourcePositions = _.filter(_.flatten(_.map(this.room.sources, s => s.pos.neighbors)),pos => 
											pos.isWalkable(true));
			const walkableControllerPositions =  _.filter(this.room.controller!.pos.neighbors, pos => 
											pos.isWalkable(true));
			return (walkableSourcePositions.length == 0) && (walkableControllerPositions.length == 0);
		}
		return false;
	}

	run() {
		/* // commented out as the overseer will kick in first and place a colonization flag before getting suspended.
		// suspend colony as soon as it becomes RCL1
		if(this.room && this.room.my && this.room.controller!.level == 1) {
			const colonyMemory = Memory.colonies[this.room.name] as ColonyMemory | undefined;
			if (colonyMemory && !colonyMemory.suspend) {
				OvermindConsole.suspendColony(this.room.name);
			}
		}
		*/
		
		if(!(Game.time % 25 == 0 && this.room)) {
			return;
		} 

		// run the below every 25 ticks
		if(this.room.my && this.room.controller!.level > 1) {
			if(this.isPoisoned()) {
				// unsuspend and unclaim.
				OvermindConsole.unsuspendColony(this.room.name);
				this.room.controller!.unclaim();
				log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: operation completed.`);
				this.remove();
			} else {
				const ret = this.colony.controller.activateSafeMode();
				if(ret == OK) {
					log.info(`${this.print}: ${printRoomName(this.pos.roomName)} 
							   - activated safeMode until poison operation is complete`);
				}
			}
		}

		// Remove if owned by other player
		if (!!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
	}
}





