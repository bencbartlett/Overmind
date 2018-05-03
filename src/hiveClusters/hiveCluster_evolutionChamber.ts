// Evolution chamber: manages lab boosting behavior

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';
import {Mem} from '../memory';
import {TerminalNetwork} from '../logistics/TerminalNetwork';

interface EvolutionChamberMemory {
	labMineralTypes: {
		[labID: string]: _ResourceConstantSansEnergy;
	}
}

@profile
export class EvolutionChamber extends HiveCluster {
	storage: StructureStorage;								// The colony storage, also the instantiation object
	link: StructureLink | undefined;						// Link closest to storage
	terminal: StructureTerminal | undefined;				// The colony terminal
	terminalNetwork: TerminalNetwork;						// Reference to Overmind.terminalNetwork
	labs: StructureLab[];									// Colony labs
	settings: {};

	constructor(colony: Colony, terminal: StructureTerminal) {
		super(colony, terminal, 'evolutionChamber');
		// Register physical components
		this.terminal = terminal;
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
		this.labs = colony.labs;
		this.settings = {};
	}

	get memory(): CommandCenterMemory {
		return Mem.wrap(this.colony.memory, 'evolutionChamber');
	}

	// Lab mineral reservations ========================================================================================

	reserveLab(lab: StructureLab, mineralType: _ResourceConstantSansEnergy) {

	}

	// Initialization and operation ====================================================================================

	init(): void {

	}

	run(): void {

	}

	visuals() {

	}
}

