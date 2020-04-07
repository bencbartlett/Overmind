import {log} from '../../console/log';
import {RoomIntel} from '../../intel/RoomIntel';
import {HarassOverlord} from '../../overlords/offense/harass';
import {profile} from '../../profiler/decorator';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';

interface DirectiveHarassMemory extends FlagMemory {
	enhanced?: boolean;
	aggressive?: boolean; // Harass EVERYONE
	targetPlayer?: string;
	roomsToHarass: string[];
	nextSpawnTime: number;		// Wait till this time to spawn
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
		this.memory.nextSpawnTime = Game.time;
		if (this.memory.targetPlayer == MY_USERNAME) {
			log.error(`Ahhhhhh harassing self in room ${flag.pos.roomName}`);
			this.remove();
		} else {
			log.alert(`Starting harass on ${flag.pos.roomName} owned by ${this.memory.targetPlayer}`);
		}
		if (this.memory.targetPlayer) {
			this.memory.roomsToHarass = this.findNearbyReservedRooms(flag.pos.roomName, this.memory.targetPlayer);
		}
	}

	spawnMoarOverlords() {
		// For now, just spawn from RCL 5+ rooms
		this.overlords.harassOverlord = new HarassOverlord(this);
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
		const whitelist = Memory.settings.allies;
		const reservedByTargetPlayer: string[] = [];
		const adjacentRooms = _.values(Game.map.describeExits(roomName)) as string[];
		adjacentRooms.forEach(room => {
			const reservation = RoomIntel.roomReservedBy(room);
			console.log('Checking for harass in room ' + room);
			if (reservation && this.memory.aggressive ? !whitelist.includes(reservation) : reservation == playerName) {
				reservedByTargetPlayer.push(room);
				// TODO This will double add rooms next to owned rooms, making it more likely to harass them, reconsider
				(_.values(Game.map.describeExits(room)) as string[]).forEach(room => {
					if (RoomIntel.roomReservedBy(room) == playerName) {
						reservedByTargetPlayer.push(room);
					}
				});
			}
		});
		Game.notify(`Looking for nearby rooms to harass, found ${reservedByTargetPlayer}`);
		return reservedByTargetPlayer;
	}

	run(): void {
		// Probably something modifying frequency of harassment

	}
}
