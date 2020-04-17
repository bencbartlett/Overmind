import {Roles, Setups} from '../../creepSetups/setups';
import {DirectivePoisonRoom} from '../../directives/colony/poisonRoom';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {packPos} from '../../utilities/packrat';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';


/**
 * Spawn roomPoisoner - upgrqde controller to lvl2, wall in controller then sources.
 */
@profile
export class RoomPoisonerOverlord extends Overlord {

	roomPoisoners: Zerg[];

	private blockPositions: RoomPosition[];

	static settings: {
		wallHits: 1;
	};

	constructor(directive: DirectivePoisonRoom, priority = OverlordPriority.outpostOffense.roomPoisoner) {
		super(directive, 'PoisonRoom', priority);
		this.roomPoisoners = this.zerg(Roles.roomPoisoner);
	}

	init() {
		// Re-compute the list of positions to block
		if (this.room) {
			const thingsToBlock = _.compact([this.room.controller, ...this.room.sources]) as RoomObject[];
			const neighborTiles = _.unique(_.flatten(_.map(thingsToBlock, obj => obj.pos.neighbors)),
										   pos => packPos(pos));
			this.blockPositions = _.filter(neighborTiles, pos => pos.isWalkable(true));
		} else {
			this.blockPositions = [];
		}

		if (this.room && this.room.dangerousPlayerHostiles.length == 0) {
			this.wishlist(1, Setups.roomPoisoner);
		}
	}

	private handleRoomPoisoner(posioner: Zerg): void {
		// Recharge if needed
		if (posioner.carry.energy < BUILD_POWER) {
			posioner.task = Tasks.recharge();
			return;
		}
		// Go to Target Room
		if (!posioner.inSameRoomAs(this)) {
			posioner.goTo(this.pos, {pathOpts:{ensurePath: true, avoidSK: true}});
			return;
		}
		// If you're in the room
		if (this.room && this.room.controller && this.room.controller.my) {
			// Upgrade controller to level 2
			if (this.room.controller.level! < 2) {
				posioner.task = Tasks.upgrade(this.room.controller);
				return;
			}
			// Fortify any walls below threshold (can't used cached room.walls here)
			const wallsUncached = this.room.find(FIND_STRUCTURES,
												 {filter: {structureType: STRUCTURE_WALL}}) as StructureWall[];
			const fortifyTarget = _.find(wallsUncached, wall => wall.hits < RoomPoisonerOverlord.settings.wallHits);
			if (fortifyTarget) {
				posioner.task = Tasks.fortify(fortifyTarget, RoomPoisonerOverlord.settings.wallHits);
				return;
			}
			// Construct walls
			const wallConstructionSite = _.first(this.room.constructionSites);
			if (wallConstructionSite) {
				posioner.task = Tasks.build(wallConstructionSite);
				return;
			}
			// If nothing to do, then move away from possible construction site locations
			posioner.flee(this.blockPositions, {}, {fleeRange: 4});
		}
	}

	run() {
		this.autoRun(this.roomPoisoners, roomPoisoner => this.handleRoomPoisoner(roomPoisoner));
	}
}
