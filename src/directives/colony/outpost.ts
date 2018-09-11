import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {ReservingOverlord} from '../../overlords/colonization/reserver';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {RoomIntel} from '../../intel/RoomIntel';
import {log} from '../../console/log';

@profile
export class DirectiveOutpost extends Directive {

	static directiveName = 'outpost';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_PURPLE;

	static settings = {
		canSpawnReserversAtRCL: 3,
	};

	constructor(flag: Flag) {
		super(flag);
		// if (!this.room) {
		// 	// Push source / output positions to colony.destinations if room is invisible for correct road routings
		// 	let savedSources = Memory.rooms[this.pos.roomName] ? Memory.rooms[this.pos.roomName].src || [] : [];
		// 	for (let src of savedSources) {
		// 		let pos: RoomPosition;
		// 		if (src.contnr) {
		// 			pos = derefCoords(src.contnr, this.pos.roomName);
		// 		} else {
		// 			pos = derefCoords(src.c, this.pos.roomName);
		// 		}
		// 		this.colony.destinations.push(pos);
		// 	}
		// }
	}

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

