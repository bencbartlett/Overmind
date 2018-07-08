import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {ScoutSetup} from './stationary';
import {Colony} from '../../Colony';
import {Tasks} from '../../tasks/Tasks';

const DEFAULT_NUM_SCOUTS = 3;

@profile
export class RandomWalkerScoutOverlord extends Overlord {

	scouts: Zerg[];

	constructor(colony: Colony, priority = OverlordPriority.scouting.randomWalker) {
		super(colony, 'scout', priority);
		this.scouts = this.zerg(ScoutSetup.role);
	}

	init() {
		this.wishlist(DEFAULT_NUM_SCOUTS, ScoutSetup);
	}

	private handleScout(scout: Zerg) {
		// Stomp on enemy construction sites
		let enemyConstructionSites = scout.room.find(FIND_HOSTILE_CONSTRUCTION_SITES);
		if (enemyConstructionSites.length > 0) {
			scout.goTo(enemyConstructionSites[0].pos, {range: 0});
		}
		// Pick a new room
		let neighboringRooms = _.values(Game.map.describeExits(scout.pos.roomName)) as string[];
		let roomName = _.sample(neighboringRooms);
		if (Game.map.isRoomAvailable(roomName)) {
			scout.task = Tasks.goToRoom(roomName);
		}
	}

	run() {
		for (let scout of this.scouts) {
			if (scout.isIdle) {
				this.handleScout(scout);
			}
			scout.run();
		}
	}
}
