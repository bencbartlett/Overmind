import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';

// export const TERMINAL_STATE_EVACUATE: TerminalState = {
// 	name     : 'evacuate',
// 	type     : 'in/out',
// 	amounts  : {[RESOURCE_ENERGY]: 10000,},
// 	tolerance: 900,
// };

const EVACUATE_STATE_TIMEOUT = 25000;

/**
 * Put the colony's terminal in an evacuation state, which pushes resources out of a room which is about to be breached
 */
@profile
export class DirectiveTerminalEvacuateState extends Directive {

	static directiveName = 'evacuateState';
	static color = COLOR_BROWN;
	static secondaryColor = COLOR_RED;

	// colony: Colony | undefined; // this is technically unallowable, but at end of life, colony can be undefined

	constructor(flag: Flag) {
		super(flag);
		this.refresh();
	}

	refresh() {
		super.refresh();
		this.colony.state.isEvacuating = true;
	}

	spawnMoarOverlords() {

	}

	init() {
		if (this.colony && this.colony.terminal) {
			for (const resource of RESOURCES_ALL) {
				if (resource == RESOURCE_ENERGY) { // keep a little energy just to keep the room functioning
					Overmind.terminalNetwork.exportResource(this.colony, resource, {
						target   : 10000,
						tolerance: 2000,
						surplus  : 15000,
					});
				} else {
					Overmind.terminalNetwork.exportResource(this.colony, <ResourceConstant>resource);
				}
			}
		}
		if (Game.time % 25 == 0) {
			log.alert(`${this.pos.print}: evacuation terminal state active!`);
		}
		this.alert('Evacuation terminal state active!', NotifierPriority.High);
	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (!this.colony || !this.colony.terminal || !!this.colony.controller.safeMode
			|| Game.time > (this.memory[MEM.TICK] || 0) + EVACUATE_STATE_TIMEOUT) {
			this.remove();
		}
	}
}
