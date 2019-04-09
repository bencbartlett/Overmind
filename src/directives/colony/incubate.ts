import { Colony } from '../../Colony';
import { log } from '../../console/log';
import { RoomIntel } from '../../intel/RoomIntel';
import { SpawnGroup } from '../../logistics/SpawnGroup';
import { ClaimingOverlord } from '../../overlords/colonization/claimer';
import { profile } from '../../profiler/decorator';
import { Directive } from '../Directive';
import { MY_USERNAME } from '../../~settings';


/**
 * Claims a new room and incubates it from the nearest (or specified) colony
 */
@profile
export class DirectiveIncubate extends Directive {

	static directiveName = 'incubate';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_WHITE;

	incubatee: Colony | undefined;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 7);
		// Register incubation status
		this.incubatee = this.room ? Overmind.colonies[Overmind.colonyMap[this.room.name]] : undefined;
		if (this.incubatee) {
			this.incubatee.isIncubating = true;
			this.incubatee.spawnGroup = new SpawnGroup(this.incubatee);
		}
	}

	spawnMoarOverlords() {
		if (!this.incubatee) { // colony isn't claimed yet
			this.overlords.claim = new ClaimingOverlord(this);
		}
	}

	init() {

	}

	run() {
		if (this.incubatee) {
			if (this.incubatee.level >= 7 && this.incubatee.storage && this.incubatee.terminal) {
				this.remove();
			}
		}

		// if reserved or owned by Overmind user - throw warning but don't remove? Included code to remove, just commented out.
		let AssimilatedRoomOwner = (typeof RoomIntel.roomOwnedBy(this.pos.roomName) === 'string' && RoomIntel.roomOwnedBy(this.pos.roomName) != MY_USERNAME && Assimilator.isAssimilated(RoomIntel.roomOwnedBy(this.pos.roomName)!))
		let AssimilatedRoomReserved = (typeof RoomIntel.roomReservedBy(this.pos.roomName) === 'string' && RoomIntel.roomReservedBy(this.pos.roomName) != MY_USERNAME && Assimilator.isAssimilated(RoomIntel.roomReservedBy(this.pos.roomName)!))
		//log.debug(`${this.print} Owned by: ${RoomIntel.roomOwnedBy(this.pos.roomName)}, who is ${AssimilatedRoomOwner} Assimilated. Reserved by: ${RoomIntel.roomReservedBy(this.pos.roomName)}, who is ${AssimilatedRoomReserved} Assimilated`)
		if (Game.time % 10 == 2 && AssimilatedRoomOwner) {
			log.warning(`${this.print} is in a room controlled by another Overmind user ${RoomIntel.roomOwnedBy(this.pos.roomName)}!`)
			//this.remove();
		}
		else if (Game.time % 10 == 2 && AssimilatedRoomReserved) {
			log.warning(`${this.print} is in a room controlled by another Overmind user ${RoomIntel.roomReservedBy(this.pos.roomName)}!`)
			//this.remove();
		}
	}
}
