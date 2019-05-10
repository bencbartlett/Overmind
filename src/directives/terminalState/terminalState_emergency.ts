import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';

export const TERMINAL_STATE_EMERGENCY: TerminalState = {
	name     : 'emergency',
	type     : 'in',
	amounts  : {
		[RESOURCE_ENERGY]                      : 25000,
		[RESOURCE_CATALYZED_GHODIUM_ALKALIDE]  : 3000,
		[RESOURCE_CATALYZED_ZYNTHIUM_ACID]     : 3000,
		[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] : 3000,
		[RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: 3000,
		[RESOURCE_CATALYZED_LEMERGIUM_ACID]    : 3000,
		[RESOURCE_CATALYZED_KEANIUM_ALKALIDE]  : 3000,
		[RESOURCE_CATALYZED_UTRIUM_ACID]       : 3000,
	},
	tolerance: 500
};

const EMERGENCY_STATE_TIMEOUT = 10000;


/**
 * Put the colony's terminal in an emergency state, which maintains supplies of T3 boots during defensive operations
 */
@profile
export class DirectiveTerminalEmergencyState extends Directive {

	static directiveName = 'emergencyState';
	static color = COLOR_BROWN;
	static secondaryColor = COLOR_ORANGE;

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
			Overmind.terminalNetwork.registerTerminalState(this.terminal, TERMINAL_STATE_EMERGENCY);
		}
		if (Game.time % 25 == 0) {
			log.alert(`${this.pos.print}: emergency terminal state active!`, NotifierPriority.High);
		}
	}

	spawnMoarOverlords() {

	}

	init() {
		this.alert('Emergency terminal state active!');
	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (!this.colony || !this.terminal || Game.time > (this.memory[_MEM.TICK] || 0) + EMERGENCY_STATE_TIMEOUT) {
			this.remove();
		}
	}
}
