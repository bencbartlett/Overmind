import {Directive} from '../Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {ExtractorOverlord} from '../../overlords/mining/extractor';

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
		let priority = this.room && this.room.my ? OverlordPriority.ownedRoom.mineral
												 : OverlordPriority.remoteSKRoom.mineral;
		this.overlords.extract = new ExtractorOverlord(this, priority);
	}

	init() {

	}

	run() {

	}

}


