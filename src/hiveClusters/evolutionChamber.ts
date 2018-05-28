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
	terminal: StructureTerminal | undefined;				// The colony terminal
	terminalNetwork: TerminalNetwork;						// Reference to Overmind.terminalNetwork
	labs: StructureLab[];									// Colony labs
	reagentLabs: StructureLab[];
	productLabs: StructureLab[];
	boostingLab: StructureLab;

	static settings = {};

	constructor(colony: Colony, terminal: StructureTerminal) {
		super(colony, terminal, 'evolutionChamber');
		// Register physical components
		this.terminal = terminal;
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
		this.labs = colony.labs;
		// Boosting lab is the closest to terminal (only lab with range=1 in my layout)
		this.boostingLab = this.terminal.pos.findClosestByRange(this.labs);
		// Reagent labs are range=2 from all other labs (there are two in my layout at RCL8)
		let range2Labs = _.filter(this.labs, lab => _.all(this.labs, otherLab => lab.pos.inRangeTo(otherLab, 2)));
		this.reagentLabs = _.take(_.sortBy(range2Labs, lab => lab == this.boostingLab ? 1 : 0), 2); // boostLab to end
		// Product labs are everything that isn't a reagent lab. (boostingLab can also be a productLab)
		this.productLabs = _.difference(this.labs, this.reagentLabs);
	}

	get memory(): EvolutionChamberMemory {
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

