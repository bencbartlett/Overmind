import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {SourceReaperOverlord} from '../../overlords/mining/sourceKeeperReeper';

@profile
export class DirectiveSKOutpost extends Directive {

	static directiveName = 'outpostSK';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_YELLOW;

	static requiredRCL = 7;

	constructor(flag: Flag) {
		super(flag, DirectiveSKOutpost.requiredRCL);
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
		// 	let mineralPos = Memory.rooms[this.pos.roomName] ? Memory.rooms[this.pos.roomName].mnrl : undefined;
		// 	if (mineralPos) this.colony.destinations.push(derefCoords(mineralPos.c, this.pos.roomName));
		// }
	}

	spawnMoarOverlords() {
		this.overlords.sourceReaper = new SourceReaperOverlord(this);
	}

	init(): void {

	}

	run(): void {

	}
}

