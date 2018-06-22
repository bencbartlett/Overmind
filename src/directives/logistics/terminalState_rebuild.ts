import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {log} from '../../console/log';
import {TerminalState_Rebuild} from '../../logistics/TerminalNetwork';

@profile
export class DirectiveTerminalRebuildState extends Directive {

	static directiveName = 'rebuildState';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_ORANGE;

	// colony: Colony | undefined; // this is technically unallowable, but at end of life, colony can be undefined

	terminal: StructureTerminal | undefined;

	constructor(flag: Flag) {
		super(flag);
		// Register abandon status
		this.terminal = this.pos.lookForStructure(STRUCTURE_TERMINAL) as StructureTerminal;
		if (this.terminal) {
			Overmind.terminalNetwork.registerTerminalState(this.terminal, TerminalState_Rebuild);
		}
		if (Game.time % 25 == 0) {
			log.alert(`${this.pos.print}: rebuild terminal state active!`);
		}
	}

	init() {

	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (!this.colony || !this.terminal) {
			this.remove();
		}
	}
}
