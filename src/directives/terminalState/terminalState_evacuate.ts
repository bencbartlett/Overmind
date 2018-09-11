import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {log} from '../../console/log';

export const TerminalState_Evacuate: TerminalState = {
	name     : 'evacuate',
	type     : 'out',
	amounts  : {},
	tolerance: 500
};

const EVACUATE_STATE_TIMEOUT = 25000;

@profile
export class DirectiveTerminalEvacuateState extends Directive {

	static directiveName = 'evacuateState';
	static color = COLOR_BROWN;
	static secondaryColor = COLOR_RED;

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
			Overmind.terminalNetwork.registerTerminalState(this.terminal, TerminalState_Evacuate);
		}
		if (Game.time % 25 == 0) {
			log.alert(`${this.pos.print}: evacuation terminal state active!`);
		}
	}

	spawnMoarOverlords() {

	}

	init() {

	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (!this.colony || !this.terminal || Game.time > (this.memory.created || 0) + EVACUATE_STATE_TIMEOUT) {
			this.remove();
		}
	}
}
