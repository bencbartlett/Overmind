import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';

const REBUILD_STATE_TIMEOUT = 25000;

/**
 * Put the colony's terminal in a rebuild state, which pushes resources out of a room which is undergoing reconstruction
 * while maintaining a small reserve of energy
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
		this.colony.state.isRebuilding = true;
	}

	spawnMoarOverlords() {

	}

	init() {
		if (this.colony && this.colony.terminal) {
			for (const resource of RESOURCES_ALL) {
				if (this.colony.assets[resource] > 0) {
					if (resource == RESOURCE_ENERGY) { // keep a little energy just to keep the room functioning
						Overmind.terminalNetwork.exportResource(this.colony, resource, {
							target   : 25000,
							tolerance: 5000,
							surplus  : 35000,
						});
					} else {
						Overmind.terminalNetwork.exportResource(this.colony, <ResourceConstant>resource);
					}
				}
			}
		}
		if (Game.time % 25 == 0) {
			log.alert(`${this.pos.print}: rebuild terminal state active!`);
		}
		this.alert('Rebuild terminal state active!', NotifierPriority.High);
	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (!this.colony || !this.terminal || Game.time > (this.memory[MEM.TICK] || 0) + REBUILD_STATE_TIMEOUT) {
			this.remove();
		}
	}
}
