import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {log} from '../../lib/logger/log';

@profile
export class DirectiveAbandon extends Directive {

	static directiveName = 'abandon';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_RED;

	// colony: Colony | undefined; // this is technically unallowable, but at end of life, colony can be undefined

	constructor(flag: Flag) {
		super(flag);
		if (!this.colony) {
			log.warning(`${this.name}@${this.pos.print}: no colony!`);
			return;
		} else if (this.room != this.colony.room) {
			log.warning(`${this.name}@${this.pos.print}: must be placed in colony room!`);
			return;
		}
		// Register abandon status
		this.colony.abandoning = true;
	}

	init() {

	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (!this.colony) {
			this.remove();
		}
	}
}
