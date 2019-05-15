import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';

export const TERMINAL_STATE_REBUILD: TerminalState = {
	name     : 'rebuild',
	type     : 'in/out',
	amounts  : {
		[RESOURCE_ENERGY]: 25000,
	},
	tolerance: 1000
};

const REBUILD_STATE_TIMEOUT = 25000;

/**
 * Put the colony's terminal in a rebuild state, which pushes resources out of a room which is undergoing reconstruction
 */
@profile
export class DirectiveTerminalRebuildState extends Directive {

	static directiveName = 'rebuildState';
	static color = COLOR_BROWN;
	static secondaryColor = COLOR_YELLOW;

	// colony: Colony | undefined; // this is technically unallowable, but at end of life, colony can be undefined

	terminal: StructureTerminal | undefined;

	constructor(flag: Flag) {
		super(flag);
		this.refresh();
	}

	refresh() {
		super.refresh();
		// Register abandon status
		this.terminal = this.pos.lookForStructure(STRUCTURE_TERMINAL) as StructureTerminal;
		if (this.terminal) {
			Overmind.terminalNetwork.registerTerminalState(this.terminal, TERMINAL_STATE_REBUILD);
		}
		if (Game.time % 25 == 0) {
			log.alert(`${this.pos.print}: rebuild terminal state active!`);
		}
	}

	spawnMoarOverlords() {

	}

	init() {
		this.alert('Rebuild terminal state active!', NotifierPriority.High);
	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (!this.colony || !this.terminal || Game.time > (this.memory[_MEM.TICK] || 0) + REBUILD_STATE_TIMEOUT) {
			this.remove();
		}
	}
}
