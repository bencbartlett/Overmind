import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {ReservingOverlord} from '../../overlords/colonization/reserver';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {derefCoords} from '../../utilities/utils';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';

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
		if (!this.colony) return;
		if (this.colony.level >= DirectiveOutpost.settings.canSpawnReserversAtRCL
			&& Cartographer.roomType(this.pos.roomName) == ROOMTYPE_CONTROLLER) {
			this.overlords.reserve = new ReservingOverlord(this);
		} else {
			this.overlords.scout = new StationaryScoutOverlord(this);
		}
		if (!this.room) {
			// Push source / output positions to colony.destinations if room is invisible for correct road routings
			let savedSources = Memory.rooms[this.pos.roomName] ? Memory.rooms[this.pos.roomName].src || [] : [];
			for (let i in savedSources) {
				let src = Memory.rooms[this.pos.roomName].src![i];
				let pos: RoomPosition;
				if (src.contnr) {
					pos = derefCoords(src.contnr, this.pos.roomName);
				} else {
					pos = derefCoords(src.c, this.pos.roomName);
				}
				this.colony.destinations.push(pos);
			}
		}
	}

	init(): void {

	}

	run(): void {

	}
}

