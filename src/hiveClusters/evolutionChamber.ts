// Evolution chamber: manages lab boosting behavior

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';
import {Mem} from '../memory';
import {TerminalNetwork} from '../logistics/TerminalNetwork';
import {Shortage} from '../resources/Abathur';
import {Pathing} from '../pathing/pathing';
import {log} from '../lib/logger/log';
import {REAGENTS} from '../resources/map_resources';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';

export enum LabStatus {
	Idle              = 0,
	// ReadyForNewProcess = 1,
	AcquiringMinerals = 2,
	LoadingLabs       = 3,
	Synthesizing      = 4,
	UnloadingLabs     = 5,
}

interface EvolutionChamberMemory {
	status: LabStatus;
	activeReaction: Shortage | undefined;
	reactionQueue: Shortage[];
	labMineralTypes: {
		[labID: string]: _ResourceConstantSansEnergy;
	};
}

const EvolutionChamberMemoryDefaults: EvolutionChamberMemory = {
	status         : LabStatus.Idle,
	activeReaction : undefined,
	reactionQueue  : [],
	labMineralTypes: {},
};

export function neighboringLabs(pos: RoomPosition): StructureLab[] {
	return _.compact(_.map(pos.neighbors, neighbor => neighbor.lookForStructure(STRUCTURE_LAB))) as StructureLab[];
}

export function labsAreEmpty(labs: StructureLab[]): boolean {
	return _.all(labs, lab => lab.mineralAmount == 0);
}

@profile
export class EvolutionChamber extends HiveCluster {

	terminal: StructureTerminal;							// The colony terminal
	terminalNetwork: TerminalNetwork;						// Reference to Overmind.terminalNetwork
	labs: StructureLab[];									// Colony labs
	reagentLabs: StructureLab[];
	productLabs: StructureLab[];
	boostingLab: StructureLab;
	transportRequests: TransportRequestGroup;				// Box for resource requests

	memory: EvolutionChamberMemory;

	private labReservations: {
		[labID: string]: { mineralType: string, amount: number }
	};

	static settings = {};

	constructor(colony: Colony, terminal: StructureTerminal) {
		super(colony, terminal, 'evolutionChamber');
		this.memory = Mem.wrap(this.colony.memory, 'evolutionChamber', EvolutionChamberMemoryDefaults);
		// Register physical components
		this.terminal = terminal;
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
		this.labs = colony.labs;
		// Boosting lab is the closest by path to terminal (fastest to empty and refill)
		this.boostingLab = _.first(_.sortBy(this.labs, lab => Pathing.distance(this.terminal.pos, lab.pos)));
		// Reagent labs are range=2 from all other labs (there are two in my layout at RCL8)
		let range2Labs = _.filter(this.labs, lab => _.all(this.labs, otherLab => lab.pos.inRangeTo(otherLab, 2)));
		this.reagentLabs = _.take(_.sortBy(range2Labs, lab => lab == this.boostingLab ? 1 : 0), 2); // boostLab to end
		// Product labs are everything that isn't a reagent lab. (boostingLab can also be a productLab)
		this.productLabs = _.difference(this.labs, this.reagentLabs);
		// This keeps track of reservations for boosting
		this.labReservations = {};
		// Evolution chamber shares a common request group with command center
		if (this.colony.commandCenter) {
			this.transportRequests = this.colony.commandCenter.transportRequests;
		} else {
			this.transportRequests = new TransportRequestGroup();
		}
	}

	private initLabStatus(): void {

		if (!this.memory.activeReaction && this.memory.status != LabStatus.Idle) {
			log.warning(`No active reaction at ${this.room.print}!`);
			this.memory.status = LabStatus.Idle;
		}

		switch (this.memory.status) {
			case LabStatus.Idle:
				if (this.memory.activeReaction) {
					let [ing1, ing2] = REAGENTS[this.memory.activeReaction.mineralType];
					log.info(`${this.room.print}: starting synthesis of ${ing1} + ${ing2} -> ` +
							 this.memory.activeReaction.mineralType);
					this.memory.status = LabStatus.AcquiringMinerals;
				} else {
					this.memory.status = LabStatus.Idle;
				}
				break;

			case LabStatus.AcquiringMinerals:
				let missingIngredients = this.colony.abathur.getMissingBasicMinerals([this.memory.activeReaction!]);
				if (_.any(missingIngredients, amount => amount > 0)) {
					// Acquiring minerals if you don't have everything you need in assets
					this.memory.status = LabStatus.AcquiringMinerals;
				} else {
					// Loading labs if all minerals are present but labs not at desired capacity yet
					this.memory.status = LabStatus.LoadingLabs;
				}
				break;

			case LabStatus.LoadingLabs:
				if (_.any(this.reagentLabs, lab => lab.mineralAmount < this.memory.activeReaction!.amount)) {
					this.memory.status = LabStatus.LoadingLabs;
				} else {
					this.memory.status = LabStatus.Synthesizing;
				}
				break;

			case LabStatus.Synthesizing:
				if (_.any(this.reagentLabs, lab => lab.mineralAmount > 0)) {
					this.memory.status = LabStatus.Synthesizing;
				} else {
					this.memory.status = LabStatus.UnloadingLabs;
				}
				break;

			case LabStatus.UnloadingLabs:
				if (_.any([...this.reagentLabs, ...this.productLabs], lab => lab.mineralAmount > 0)) {
					this.memory.status = LabStatus.UnloadingLabs;
				} else {
					this.memory.status = LabStatus.Idle;
				}
				break;

			default:
				log.warning(`Bad lab state at ${this.room.print}!`);
				this.memory.status = LabStatus.Idle;
				break;
		}
	}

	private registerRequests(): void {
		// Refill labs needing energy
		let refillLabs = _.filter(this.labs, lab => lab.energy < lab.energyCapacity);
		_.forEach(refillLabs, lab => this.transportRequests.request(lab));
		// TODO: Request resources delivered to lab
	}

	// get memory(): EvolutionChamberMemory {
	// 	return Mem.wrap(this.colony.memory, 'evolutionChamber', EvolutionChamberMemoryDefaults);
	// }

	// Lab mineral reservations ========================================================================================

	/* Reserves a product lab for boosting with a compound unrelated to production */
	reserveLab(mineralType: _ResourceConstantSansEnergy, amount: number, lab = this.boostingLab) {
		_.remove(this.productLabs, productLab => productLab.ref == lab.ref);
		this.labReservations[lab.id] = {mineralType: mineralType, amount: amount};
	}

	// Initialization and operation ====================================================================================

	init(): void {
		// Get a reaction queue if needed
		if (!this.memory.reactionQueue) {
			this.memory.reactionQueue = this.colony.abathur.getReactionQueue();
		}
		if (this.memory.status == LabStatus.Idle) {
			this.memory.activeReaction = this.memory.reactionQueue.shift();
		}
		this.initLabStatus();
	}

	run(): void {

	}

	visuals() {

	}
}

