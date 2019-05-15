import {RoomIntel} from '../../intel/RoomIntel';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {HarassOverlord} from "../../overlords/offense/harass";
import {log, Log} from "../../console/log";
import {MY_USERNAME} from "../../~settings";

interface DirectiveHarassMemory extends FlagMemory {
	enhanced?: boolean;
	targetPlayer?: string;
	roomsToHarass: string[];
}

/**
 * Harass Directive that wanders through enemy rooms killing stuff
 * Placed on an enemy room, it will harass all of it's remotes periodically
 */
@profile
export class DirectiveHarass extends Directive {

	static directiveName = 'harass';
	static color = COLOR_RED;
	static secondaryColor = COLOR_WHITE;

	memory: DirectiveHarassMemory;

	constructor(flag: Flag) {
		super(flag);
		this.memory.targetPlayer = RoomIntel.roomOwnedBy(flag.pos.roomName);
		if (this.memory.targetPlayer == MY_USERNAME) {
			log.error(`Ahhhhhh harassing self in room ${flag.pos.roomName}`);
			this.remove();
		}
		if (this.memory.targetPlayer) {
			this.memory.roomsToHarass = this.findNearbyReservedRooms(flag.pos.roomName, this.memory.targetPlayer);
		}
	}

	spawnMoarOverlords() {
		// For now, just spawn from RCL 5+ rooms
		this.overlords.harassOverlord = new HarassOverlord(this, this.memory.enhanced);
	}

	init(): void {
		// if
		// if (!this.memory.roomsToHarass && this.memory.targetPlayer)


	}

	findNearbyReservedRoomsForHarassment() {
		if (this.memory.targetPlayer) {
			return this.findNearbyReservedRooms(this.flag.pos.roomName, this.memory.targetPlayer);
		}
		return [];
	}

	/**
	 * Finds the rooms to harass
	 *
	 * @param roomName
	 * @param playerName
	 */
	findNearbyReservedRooms(roomName: string, playerName: string): string[] {
		if (!this.memory.targetPlayer) {
			log.error(`Unable to find which player to harass in room ${roomName}`);
			return [];
		}
		let reservedByTargetPlayer: string[] = [];
		let adjacentRooms = _.values(Game.map.describeExits(roomName)) as string[];
		adjacentRooms.forEach(room => {
			if (RoomIntel.roomReservedBy(room) == playerName) {
				reservedByTargetPlayer.push(room);
				// This will double add rooms next to owned rooms, making it more likely to harass them
				(_.values(Game.map.describeExits(room)) as string[]).forEach(room => {
					if (RoomIntel.roomReservedBy(room) == playerName) {
						reservedByTargetPlayer.push(room);
					}
				})
			}
		});
		Game.notify(`Looking for nearby rooms to harass, found ${reservedByTargetPlayer}`);
		return reservedByTargetPlayer;
	}

	run(): void {
		// Probably something modifying frequency of harassment

	}
}
