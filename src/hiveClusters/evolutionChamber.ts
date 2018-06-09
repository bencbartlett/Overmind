// Evolution chamber: manages lab boosting behavior

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';
import {Mem} from '../memory';
import {TerminalNetwork} from '../logistics/TerminalNetwork';
import {Reaction} from '../resources/Abathur';
import {Pathing} from '../pathing/pathing';
import {log} from '../lib/logger/log';
import {REAGENTS} from '../resources/map_resources';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';
import {Priority} from '../settings/priorities';

const LabStatus = {
	Idle             : 0,
	AcquiringMinerals: 1,
	LoadingLabs      : 2,
	Synthesizing     : 3,
	UnloadingLabs    : 4,
};

const LabStageTimeouts = {
	Idle             : Infinity,
	AcquiringMinerals: 100,
	LoadingLabs      : 50,
	Synthesizing     : 10000,
	UnloadingLabs    : 1000
};

interface EvolutionChamberMemory {
	status: number;
	statusTick: number;
	activeReaction: Reaction | undefined;
	reactionQueue: Reaction[];
	labMineralTypes: {
		[labID: string]: _ResourceConstantSansEnergy;
	};
}

const EvolutionChamberMemoryDefaults: EvolutionChamberMemory = {
	status         : LabStatus.Idle,
	statusTick     : 0,
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

	// memory: EvolutionChamberMemory;

	private labReservations: {
		[labID: string]: { mineralType: string, amount: number }
	};

	static settings = {};

	constructor(colony: Colony, terminal: StructureTerminal) {
		super(colony, terminal, 'evolutionChamber');
		// this.memory = Mem.wrap(this.colony.memory, 'evolutionChamber', EvolutionChamberMemoryDefaults);
		// Register physical components
		this.terminal = terminal;
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
		this.labs = colony.labs;
		// Boosting lab is the closest by path to terminal (fastest to empty and refill)
		this.boostingLab = _.first(_.sortBy(this.labs, lab => Pathing.distance(this.terminal.pos, lab.pos)));
		// Reagent labs are range=2 from all other labs (there are two in my layout at RCL8)
		let range2Labs = _.filter(this.labs, lab => _.all(this.labs, otherLab => lab.pos.inRangeTo(otherLab, 2)) &&
													lab != this.boostingLab);
		this.reagentLabs = _.take(_.sortBy(range2Labs, lab => -1 * neighboringLabs(lab.pos).length), 2); // most neighbr
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

	get memory(): EvolutionChamberMemory {
		return Mem.wrap(this.colony.memory, 'evolutionChamber', EvolutionChamberMemoryDefaults);
	}

	private statusTimeoutCheck(): void {
		let ticksInStatus = Game.time - this.memory.statusTick;
		let timeout = false;
		switch (this.memory.status) {
			case LabStatus.Idle:
				timeout = ticksInStatus > LabStageTimeouts.Idle;
				break;
			case LabStatus.AcquiringMinerals:
				timeout = ticksInStatus > LabStageTimeouts.AcquiringMinerals;
				break;
			case LabStatus.LoadingLabs:
				timeout = ticksInStatus > LabStageTimeouts.LoadingLabs;
				break;
			case LabStatus.Synthesizing:
				timeout = ticksInStatus > LabStageTimeouts.Synthesizing;
				break;
			case LabStatus.UnloadingLabs:
				timeout = ticksInStatus > LabStageTimeouts.UnloadingLabs;
				break;
			default:
				log.warning(`Bad lab state at ${this.room.print}!`);
				this.memory.status = LabStatus.Idle;
				this.memory.statusTick = Game.time;
				break;
		}
		if (timeout) {
			log.warning(`${this.room.print}: stuck in state ${this.memory.status} for ${ticksInStatus} ticks, ` +
						`rebuilding reaction queue and reverting to idle state!`);
			this.memory.status = LabStatus.Idle;
			this.memory.statusTick = Game.time;
			this.memory.activeReaction = undefined;
			this.memory.reactionQueue = [];
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
					this.memory.statusTick = Game.time;
				}
				break;

			case LabStatus.AcquiringMinerals: // "We acquire more mineralzzz"
				let missingIngredients = this.colony.abathur.getMissingBasicMinerals([this.memory.activeReaction!]);
				if (_.all(missingIngredients, amount => amount == 0)) {
					// Loading labs if all minerals are present but labs not at desired capacity yet
					this.memory.status = LabStatus.LoadingLabs;
					this.memory.statusTick = Game.time;
				}
				break;

			case LabStatus.LoadingLabs:
				if (_.all(this.reagentLabs, lab => lab.mineralAmount >= this.memory.activeReaction!.amount &&
												   REAGENTS[this.memory.activeReaction!.mineralType]
													   .includes(<ResourceConstant>lab.mineralType))) {
					this.memory.status = LabStatus.Synthesizing;
					this.memory.statusTick = Game.time;
				}
				break;

			case LabStatus.Synthesizing:
				if (_.any(this.reagentLabs, lab => lab.mineralAmount < LAB_REACTION_AMOUNT)) {
					this.memory.status = LabStatus.UnloadingLabs;
					this.memory.statusTick = Game.time;
				}
				break;

			case LabStatus.UnloadingLabs:
				if (_.all([...this.reagentLabs, ...this.productLabs], lab => lab.mineralAmount == 0)) {
					this.memory.status = LabStatus.Idle;
					this.memory.statusTick = Game.time;
				}
				break;

			default:
				log.warning(`Bad lab state at ${this.room.print}!`);
				this.memory.status = LabStatus.Idle;
				this.memory.statusTick = Game.time;
				break;
		}
		this.statusTimeoutCheck();
	}

	private reagentLabRequests(): void {
		if (this.memory.activeReaction) {
			let {mineralType, amount} = this.memory.activeReaction;
			let [ing1, ing2] = REAGENTS[mineralType];
			let [lab1, lab2] = this.reagentLabs;
			// Empty out any incorrect minerals and request the correct reagents
			if (this.memory.status == LabStatus.UnloadingLabs || (lab1.mineralType != ing1 && lab1.mineralAmount > 0)) {
				this.transportRequests.provide(lab1, Priority.Normal, {resourceType: lab1.mineralType});
			} else if (this.memory.status == LabStatus.LoadingLabs && lab1.mineralAmount < amount) {
				this.transportRequests.request(lab1, Priority.Normal, {
					resourceType: ing1,
					amount      : amount - lab1.mineralAmount,
				});
			}
			if (this.memory.status == LabStatus.UnloadingLabs || (lab2.mineralType != ing2 && lab2.mineralAmount > 0)) {
				this.transportRequests.provide(lab2, Priority.Normal, {resourceType: lab2.mineralType});
			} else if (this.memory.status == LabStatus.LoadingLabs && lab2.mineralAmount < amount) {
				this.transportRequests.request(lab2, Priority.Normal, {
					resourceType: ing2,
					amount      : amount - lab2.mineralAmount,
				});
			}
		} else {
			// Labs should be empty when no reaction process is currently happening
			for (let lab of this.reagentLabs) {
				this.transportRequests.provide(lab, Priority.Normal, {resourceType: lab.mineralType});
			}
		}
	}

	private productLabRequests(): void {
		if (this.memory.activeReaction) {
			let {mineralType, amount} = this.memory.activeReaction;
			for (let lab of this.productLabs) {
				let labHasWrongMineral = lab.mineralType != mineralType && lab.mineralAmount > 0;
				let labIsFull = lab.mineralAmount == lab.mineralCapacity;
				// Empty out incorrect minerals or if it's time to unload or if lab is full
				if ((this.memory.status == LabStatus.UnloadingLabs && lab.mineralAmount > 0) ||
					labHasWrongMineral || labIsFull) {
					this.transportRequests.provide(lab, Priority.NormalLow, {resourceType: lab.mineralType});
				}
			}
		} else {
			// Labs should be empty when no reaction process is currently happening
			for (let lab of this.productLabs) {
				this.transportRequests.provide(lab, Priority.NormalLow, {resourceType: lab.mineralType});
			}
		}
	}

	private boosterLabRequests(lab: StructureLab): void {
		let {mineralType, amount} = this.labReservations[lab.id];
		// Empty out incorrect minerals
		if (lab.mineralType != mineralType && lab.mineralAmount > 0) {
			this.transportRequests.provide(lab, Priority.NormalHigh, {resourceType: lab.mineralType});
		} else {
			this.transportRequests.request(lab, Priority.NormalHigh, {
				resourceType: <ResourceConstant>mineralType,
				amount      : amount - lab.mineralAmount
			});
		}
	}

	private registerRequests(): void {
		// Refill labs needing energy
		let refillLabs = _.filter(this.labs, lab => lab.energy < lab.energyCapacity);
		_.forEach(refillLabs, lab => this.transportRequests.request(lab, Priority.NormalLow));
		// Request resources delivered to / withdrawn from each type of lab
		this.reagentLabRequests();
		this.productLabRequests();
		_.forEach(_.keys(this.labReservations), id => this.boosterLabRequests(<StructureLab>deref(id)));
	}

	// Lab mineral reservations ========================================================================================

	/* Reserves a product lab for boosting with a compound unrelated to production */
	reserveLab(mineralType: _ResourceConstantSansEnergy, amount: number, lab = this.boostingLab) {
		_.remove(this.productLabs, productLab => productLab.ref == lab.ref);
		this.labReservations[lab.id] = {mineralType: mineralType, amount: amount};
	}

	// Initialization and operation ====================================================================================

	init(): void {
		// Get a reaction queue if needed
		if (this.memory.reactionQueue.length == 0) {
			this.memory.reactionQueue = this.colony.abathur.getReactionQueue();
		}
		// Switch to next reaction on the queue if you are idle
		if (this.memory.status == LabStatus.Idle) {
			this.memory.activeReaction = this.memory.reactionQueue.shift();
		}
		// log.info('status: ' + this.memory.status + '  activeReaction: ' + JSON.stringify(this.memory.activeReaction));
		// log.info('reactionQueue:' + JSON.stringify(this.memory.reactionQueue));
		this.initLabStatus();
		this.registerRequests();
	}

	run(): void {
		if (this.memory.status == LabStatus.Synthesizing) {
			let [lab1, lab2] = this.reagentLabs;
			for (let lab of this.productLabs) {
				if (lab.cooldown == 0) {
					lab.runReaction(lab1, lab2);
				}
			}
		}
		if (this.terminal.cooldown == 0) {
			let queue = this.memory.reactionQueue;
			if (this.memory.activeReaction && this.memory.status == LabStatus.AcquiringMinerals) {
				queue = [this.memory.activeReaction].concat(queue);
			}
			let missingBasicMinerals = this.colony.abathur.getMissingBasicMinerals(queue);
			for (let resourceType in missingBasicMinerals) {
				if (missingBasicMinerals[resourceType] > 0) {
					this.terminalNetwork.requestResource(this.terminal, <ResourceConstant>resourceType,
														 missingBasicMinerals[resourceType]);
				}
			}
		}
	}

	visuals() {
		// for (let lab of this.reagentLabs) {
		// 	Visualizer.circle(lab.pos, 'red');
		// }
		// for (let lab of this.productLabs) {
		// 	Visualizer.circle(lab.pos, 'blue');
		// }
		// Visualizer.circle(this.boostingLab.pos, 'green');
	}
}

