import {Directive} from '../Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {ExtractorOverlord} from '../../overlords/mining/extractor';
import {log} from '../../console/log';

export class DirectiveExtract extends Directive {

	static directiveName = 'extract';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_CYAN;

	overlords: {
		extract: ExtractorOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
		this.colony.destinations.push(this.pos);
	}

	spawnMoarOverlords() {
		let priority: number;
		if (this.room && this.room.my) {
			if (this.colony.level == 8) {
				priority = OverlordPriority.ownedRoom.mineralRCL8;
			} else {
				priority = OverlordPriority.ownedRoom.mineral;
			}
		} else {
			priority = OverlordPriority.remoteSKRoom.mineral;
		}
		this.overlords.extract = new ExtractorOverlord(this, priority);
	}

	init() {

	}

	run() {
		if (this.colony.level < 6) {
			log.notify(`Removing extraction directive in ${this.pos.roomName}: room RCL insufficient.`);
			this.remove();
		}
	}

}


