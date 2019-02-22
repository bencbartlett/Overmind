import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Colony} from '../../Colony';
import {Tasks} from '../../tasks/Tasks';
import {Roles, Setups} from '../../creepSetups/setups';

const DEFAULT_NUM_SCOUTS = 3;

/**
 * Sends out scouts which randomly traverse rooms to uncover possible expansion locations and gather intel
 */
@profile
export class RandomWalkerScoutOverlord extends Overlord {

	scouts: Zerg[];

	constructor(colony: Colony, priority = OverlordPriority.scouting.randomWalker) {
		super(colony, 'scout', priority);
		this.scouts = this.zerg(Roles.scout, {notifyWhenAttacked: false});
	}

	init() {
		this.wishlist(DEFAULT_NUM_SCOUTS, Setups.scout);
	}

	private handleScout(scout: Zerg) {
		// Stomp on enemy construction sites
		let enemyConstructionSites = scout.room.find(FIND_HOSTILE_CONSTRUCTION_SITES);
		if (enemyConstructionSites.length > 0) {
			scout.goTo(enemyConstructionSites[0].pos);
		}
		// Check if room might be connected to newbie/respawn zone
		let indestructibleWalls = _.filter(scout.room.walls, wall => wall.hits == undefined);
		if (indestructibleWalls.length > 0) { // go back to origin colony if you find a room near newbie zone
			scout.task = Tasks.goToRoom(scout.colony.room.name); // todo: make this more precise
		} else {
			// Pick a new room
			let neighboringRooms = _.values(Game.map.describeExits(scout.pos.roomName)) as string[];
			let roomName = _.sample(neighboringRooms);
			if (Game.map.isRoomAvailable(roomName)) {
				scout.task = Tasks.goToRoom(roomName);
			}
		}
	}

	run() {
		this.autoRun(this.scouts, scout => this.handleScout(scout));
	}
}
