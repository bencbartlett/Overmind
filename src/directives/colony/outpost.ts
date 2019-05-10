import {log} from '../../console/log';
import {RoomIntel} from '../../intel/RoomIntel';
import {ReservingOverlord} from '../../overlords/colonization/reserver';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {Directive} from '../Directive';

/**
 * Claims a new room and incubates it from the nearest (or specified) colony
 */
@profile
export class DirectiveOutpost extends Directive {

	static directiveName = 'outpost';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_PURPLE;

	static settings = {
		canSpawnReserversAtRCL: 3,
	};

	spawnMoarOverlords() {
		if (this.colony.level >= DirectiveOutpost.settings.canSpawnReserversAtRCL) {
			if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_CONTROLLER) {
				this.overlords.reserve = new ReservingOverlord(this);
			}
		} else {
			this.overlords.scout = new StationaryScoutOverlord(this);
		}
	}

	init(): void {

	}

	run(): void {
		if (RoomIntel.roomOwnedBy(this.pos.roomName)) {
			log.warning(`Removing ${this.print} since room is owned!`);
			this.remove();
		}
		if (Game.time % 10 == 3 && this.room && this.room.controller
			&& !this.pos.isEqualTo(this.room.controller.pos) && !this.memory.setPosition) {
			this.setPosition(this.room.controller.pos);
		}
	}
}

