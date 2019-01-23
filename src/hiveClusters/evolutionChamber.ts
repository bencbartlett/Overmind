// Evolution chamber: manages lab boosting behavior

import {HiveCluster} from './_HiveCluster';
import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';
import {Mem} from '../memory/Memory';
import {TerminalNetwork} from '../logistics/TerminalNetwork';
import {Reaction} from '../resources/Abathur';
import {Pathing} from '../movement/Pathing';
import {log} from '../console/log';
import {boostParts, REAGENTS} from '../resources/map_resources';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';
import {Priority} from '../priorities/priorities';
import {Zerg} from '../zerg/Zerg';
import {TraderJoe} from '../logistics/TradeNetwork';
import {rightArrow} from '../utilities/stringConstants';
import {Stats} from '../stats/stats';
import {rollingAverage} from '../utilities/utils';
import {$} from '../caching/GlobalCache';

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

const LAB_USAGE_WINDOW = 100;

interface EvolutionChamberMemory {
	status: number;
	statusTick: number;
	activeReaction: Reaction | undefined;
	reactionQueue: Reaction[];
	labMineralTypes: {
		[labID: string]: _ResourceConstantSansEnergy;
	};
	stats: {
		totalProduction: { [resourceType: string]: number }
		avgUsage: number;
	}
}

const EvolutionChamberMemoryDefaults: EvolutionChamberMemory = {
	status         : LabStatus.Idle,
	statusTick     : 0,
	activeReaction : undefined,
	reactionQueue  : [],
	labMineralTypes: {},
	stats          : {
		totalProduction: {},
		avgUsage       : 1,
	}
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
	// productLabsNonBoosting: StructureLab[];
	boostingLabs: StructureLab[];
	transportRequests: TransportRequestGroup;				// Box for resource requests

	memory: EvolutionChamberMemory;

	private labReservations: {
		[labID: string]: { mineralType: string, amount: number }
	};
	// private boostQueue: {
	// 	[labID: string]: { mineralType: string, creepName: string }[]
	// };
	private neededBoosts: { [boostType: string]: number };

	static settings = {};

	constructor(colony: Colony, terminal: StructureTerminal) {
		super(colony, terminal, 'evolutionChamber');
		this.memory = Mem.wrap(this.colony.memory, 'evolutionChamber', EvolutionChamberMemoryDefaults);
		// Register physical components
		this.terminal = terminal;
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
		this.labs = colony.labs;
		// Reserve some easily-accessible labs which are restricted not to be reagent labs
		let restrictedLabs = this.colony.bunker ?
							 _.filter(this.labs, lab => lab.pos.findInRange(this.colony.spawns, 1).length > 0) :
							 _.take(_.sortBy(this.labs, lab => Pathing.distance(this.terminal.pos, lab.pos)), 1);
		// if (this.colony.bunker) {
		// 	this.boostingLabs = _.filter(this.labs, lab => lab.pos.findInRange(this.colony.spawns, 1).length > 0);
		// } else {
		// 	this.boostingLabs = [_.first(_.sortBy(this.labs, lab => Pathing.distance(this.terminal.pos, lab.pos)))];
		// }
		// Reagent labs are range=2 from all other labs and are not a boosting lab
		let range2Labs = _.filter(this.labs, lab => _.all(this.labs, otherLab => lab.pos.inRangeTo(otherLab, 2)));
		let reagentLabCandidates = _.filter(range2Labs, lab => !_.any(restrictedLabs, l => l.id == lab.id));
		if (this.colony.bunker && this.colony.labs.length == 10) {
			this.reagentLabs = _.take(_.sortBy(reagentLabCandidates,
											   lab => -1 * lab.pos.findInRange(this.boostingLabs, 1).length), 2);
		} else {
			this.reagentLabs = _.take(_.sortBy(reagentLabCandidates, lab => -1 * neighboringLabs(lab.pos).length), 2);
		}
		// Product labs are everything that isn't a reagent lab. (boostingLab can also be a productLab)
		this.productLabs = _.difference(this.labs, this.reagentLabs);
		// Boosting labs are product labs sorted by distance to terminal
		let unrestrictedBoostingLabs = _.sortBy(_.difference(this.productLabs, restrictedLabs),
												lab => Pathing.distance(this.terminal.pos, lab.pos));
		this.boostingLabs = [...restrictedLabs, ...unrestrictedBoostingLabs];
		// This keeps track of reservations for boosting
		this.labReservations = {};
		// this.boostQueue = {};
		this.neededBoosts = {};
		if (this.colony.commandCenter && this.colony.layout == 'twoPart') {
			// in two-part layout, evolution chamber shares a common request group with command center
			this.transportRequests = this.colony.commandCenter.transportRequests;
		} else {
			// otherwise (in bunker layout), it uses colony/hatchery transport requests
			this.transportRequests = this.colony.transportRequests;
		}
	}

	refresh() {
		this.memory = Mem.wrap(this.colony.memory, 'evolutionChamber', EvolutionChamberMemoryDefaults);
		$.refreshRoom(this);
		$.refresh(this, 'terminal', 'labs', 'boostingLabs', 'reagentLabs', 'productLabs');
		this.labReservations = {};
		// this.boostQueue = {};
		this.neededBoosts = {};
	}

	spawnMoarOverlords() {
		// Evolution chamber is attended to by queens; overlord spawned at Hatchery
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
				log.warning(`Bad lab state at ${this.print}!`);
				this.memory.status = LabStatus.Idle;
				this.memory.statusTick = Game.time;
				break;
		}
		if (timeout) {
			log.warning(`${this.print}: stuck in state ${this.memory.status} for ${ticksInStatus} ticks, ` +
						`rebuilding reaction queue and reverting to idle state!`);
			this.memory.status = LabStatus.Idle;
			this.memory.statusTick = Game.time;
			this.memory.activeReaction = undefined;
			this.memory.reactionQueue = [];
		}
	}

	private initLabStatus(): void {
		if (!this.memory.activeReaction && this.memory.status != LabStatus.Idle) {
			log.warning(`No active reaction at ${this.print}!`);
			this.memory.status = LabStatus.Idle;
		}

		switch (this.memory.status) {
			case LabStatus.Idle:
				if (this.memory.activeReaction) {
					let [ing1, ing2] = REAGENTS[this.memory.activeReaction.mineralType];
					log.info(`${this.colony.room.print}: starting synthesis of ${ing1} + ${ing2} ${rightArrow} ` +
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
				log.warning(`Bad lab state at ${this.print}!`);
				this.memory.status = LabStatus.Idle;
				this.memory.statusTick = Game.time;
				break;
		}
		this.statusTimeoutCheck();
	}

	private reagentLabRequests(reagentLabs: [StructureLab, StructureLab]): void {
		if (this.memory.activeReaction) {
			let {mineralType, amount} = this.memory.activeReaction;
			let [ing1, ing2] = REAGENTS[mineralType];
			let [lab1, lab2] = reagentLabs;
			if (!lab1 || !lab2) return;
			// Empty out any incorrect minerals and request the correct reagents
			if (this.memory.status == LabStatus.UnloadingLabs || (lab1.mineralType != ing1 && lab1.mineralAmount > 0)) {
				this.transportRequests.requestOutput(lab1, Priority.Normal, {resourceType: lab1.mineralType!});
			} else if (this.memory.status == LabStatus.LoadingLabs && lab1.mineralAmount < amount) {
				this.transportRequests.requestInput(lab1, Priority.Normal, {
					resourceType: ing1,
					amount      : amount - lab1.mineralAmount,
				});
			}
			if (this.memory.status == LabStatus.UnloadingLabs || (lab2.mineralType != ing2 && lab2.mineralAmount > 0)) {
				this.transportRequests.requestOutput(lab2, Priority.Normal, {resourceType: lab2.mineralType!});
			} else if (this.memory.status == LabStatus.LoadingLabs && lab2.mineralAmount < amount) {
				this.transportRequests.requestInput(lab2, Priority.Normal, {
					resourceType: ing2,
					amount      : amount - lab2.mineralAmount,
				});
			}
		} else {
			// Labs should be empty when no reaction process is currently happening
			for (let lab of reagentLabs) {
				if (lab.mineralType && lab.mineralAmount > 0) {
					this.transportRequests.requestOutput(lab, Priority.Normal, {resourceType: lab.mineralType});
				}
			}
		}
	}

	private productLabRequests(labs: StructureLab[]): void {
		if (this.memory.activeReaction) {
			let {mineralType, amount} = this.memory.activeReaction;
			for (let lab of this.productLabs) {
				let labHasWrongMineral = lab.mineralType != mineralType && lab.mineralAmount > 0;
				let labIsFull = lab.mineralAmount == lab.mineralCapacity;
				// Empty out incorrect minerals or if it's time to unload or if lab is full
				if ((this.memory.status == LabStatus.UnloadingLabs && lab.mineralAmount > 0) ||
					labHasWrongMineral || labIsFull) {
					this.transportRequests.requestOutput(lab, Priority.NormalLow, {resourceType: lab.mineralType!});
				}
			}
		} else {
			// Labs should be empty when no reaction process is currently happening
			for (let lab of this.productLabs) {
				if (lab.mineralType && lab.mineralAmount > 0) {
					this.transportRequests.requestOutput(lab, Priority.NormalLow, {resourceType: lab.mineralType});
				}
			}
		}
	}

	private boosterLabRequests(labs: StructureLab[]): void {
		for (let lab of labs) {
			let {mineralType, amount} = this.labReservations[lab.id];
			// Empty out incorrect minerals
			if (lab.mineralType != mineralType && lab.mineralAmount > 0) {
				this.transportRequests.requestOutput(lab, Priority.NormalHigh, {resourceType: lab.mineralType!});
			} else {
				this.transportRequests.requestInput(lab, Priority.NormalHigh, {
					resourceType: <ResourceConstant>mineralType,
					amount      : amount - lab.mineralAmount
				});
			}
		}
	}

	private registerRequests(): void {
		// Separate product labs into actively boosting or ready for reaction
		let boostingProductLabs = _.filter(this.productLabs, lab => this.labReservations[lab.id]);
		let reactionProductLabs = _.filter(this.productLabs, lab => !this.labReservations[lab.id]);
		// Request high priority energy to booster lab
		let boostingRefillLabs = _.filter(boostingProductLabs, lab => lab.energy < lab.energyCapacity);
		_.forEach(boostingRefillLabs, lab => this.transportRequests.requestInput(lab, Priority.High));
		// Refill labs needing energy with lower priority for all non-boosting labs
		let refillLabs = _.filter(reactionProductLabs, lab => lab.energy < lab.energyCapacity);
		_.forEach(refillLabs, lab => this.transportRequests.requestInput(lab, Priority.NormalLow));
		// Request resources delivered to / withdrawn from each type of lab
		this.reagentLabRequests(this.reagentLabs as [StructureLab, StructureLab]);
		this.productLabRequests(reactionProductLabs);
		this.boosterLabRequests(boostingProductLabs);
	}

	// Lab mineral reservations ========================================================================================

	/* Reserves a product lab for boosting with a compound unrelated to production */
	private reserveLab(mineralType: _ResourceConstantSansEnergy, amount: number, lab: StructureLab) {
		// _.remove(this.productLabs, productLab => productLab.id == lab.id);
		this.labReservations[lab.id] = {mineralType: mineralType, amount: amount};
	}

	/* Return the amount of a given resource necessary to fully boost a creep body */
	static requiredBoostAmount(body: BodyPartDefinition[], boostType: _ResourceConstantSansEnergy): number {
		let existingBoostCounts = _.countBy(body, part => part.boost);
		let numPartsToBeBoosted = _.filter(body, part => part.type == boostParts[boostType]).length;
		return LAB_BOOST_MINERAL * (numPartsToBeBoosted - (existingBoostCounts[boostType] || 0));
	}

	/* Return whether you have the resources to fully boost a creep body with a given resource */
	canBoost(body: BodyPartDefinition[], boostType: _ResourceConstantSansEnergy): boolean {
		let boostAmount = EvolutionChamber.requiredBoostAmount(body, boostType);
		if (this.colony.assets[boostType] >= boostAmount) {
			// Does this colony have the needed resources already?
			return true;
		} else if (this.terminalNetwork.assets[boostType] >= 2 * boostAmount) {
			// Is there enough of the resource in terminalNetwork?
			return true;
		} else {
			// Can you buy the resources on the market?
			return (Game.market.credits > TraderJoe.settings.market.boostCredits +
					boostAmount * Overmind.tradeNetwork.priceOf(boostType));
		}
	}

	/* Request boosts sufficient to fully boost a given creep to be added to the boosting queue */
	requestBoost(creep: Zerg, boostType: _ResourceConstantSansEnergy): void {
		// if (!this.boostQueue[lab.id]) {
		// 	this.boostQueue[lab.id] = [];
		// }
		// // Boost requests are prioritized by which creep has least time to live
		// this.boostQueue[lab.id] = _.sortBy([...this.boostQueue[lab.id],
		// 									{mineralType: mineralType, creepName: creep.name}],
		// 								   request => (Overmind.zerg[request.creepName].ticksToLive
		// 											   || 5000 + Overmind.zerg[request.creepName].ticksUntilSpawned
		// 											   || 9999));

		// Add the required amount to the neededBoosts
		let boostAmount = EvolutionChamber.requiredBoostAmount(creep.body, boostType);
		if (!this.neededBoosts[boostType]) {
			this.neededBoosts[boostType] = 0;
		}
		this.neededBoosts[boostType] = Math.min(this.neededBoosts[boostType] + boostAmount, LAB_MINERAL_CAPACITY);

	}

	// /* Zero-indexed position in the boosting queue of a given creep. Equals -1 if creep isn't queued. */
	// queuePosition(creep: Zerg, lab: StructureLab): number {
	// 	return _.findIndex(this.boostQueue[lab.id], request => request.creepName == creep.name);
	// }

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
		// // Set boosting lab reservations and compute needed resources
		// for (let labID in this.boostQueue) {
		// 	let boostLab = deref(labID) as StructureLab;
		// 	let boostRequest = _.first(this.boostQueue[labID]);
		// 	let boostType = boostRequest.mineralType;
		// 	let creep = Overmind.zerg[boostRequest.creepName] as Zerg;
		// 	let boostAmount = LAB_BOOST_MINERAL * (creep.getActiveBodyparts(boostParts[boostType])
		// 										   - (creep.boostCounts[boostType] || 0));
		// 	// add to the needed amount of boosts
		// 	if (!this.neededBoosts[boostType]) {
		// 		this.neededBoosts[boostType] = 0;
		// 	}
		// 	this.neededBoosts[boostType] += boostAmount;
		// 	// reserve lab once creep is born or if creep is spawning adjacent to lab
		// 	if (creep.pos.isNearTo(boostLab) || creep.ticksToLive != undefined) {
		// 		this.reserveLab(<_ResourceConstantSansEnergy>boostType, boostAmount, boostLab);
		// 	}
		// }
		// Set boosting lab reservations and compute needed resources
		for (let mineralType in this.neededBoosts) {

			if (this.neededBoosts[mineralType] == 0) continue;

			let boostLab: StructureLab | undefined = undefined;
			for (let id in this.labReservations) { // find a lab already reserved for this mineral type
				if (this.labReservations[id] && this.labReservations[id].mineralType == mineralType) {
					boostLab = deref(id) as StructureLab;
				}
			}
			if (!boostLab) { // otherwise choose the first unreserved product lab
				boostLab = _.find(this.boostingLabs, lab => !this.labReservations[lab.id]);
			}
			if (boostLab) {
				this.reserveLab(<_ResourceConstantSansEnergy>mineralType, this.neededBoosts[mineralType], boostLab);
			}
		}
		this.initLabStatus();
		this.registerRequests();
	}

	run(): void {
		// Obtain resources for boosting
		for (let resourceType in this.neededBoosts) {
			let needAmount = Math.max(this.neededBoosts[resourceType] - (this.colony.assets[resourceType] || 0), 0);
			if (needAmount > 0) {
				this.terminalNetwork.requestResource(this.terminal, <ResourceConstant>resourceType,
													 needAmount, true, 0);
			}
		}
		// Obtain resources for reaction queue
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
		// Run the reactions
		if (this.memory.status == LabStatus.Synthesizing) {
			let [lab1, lab2] = this.reagentLabs;
			for (let lab of this.productLabs) {
				if (lab.cooldown == 0) {
					let result = lab.runReaction(lab1, lab2);
					if (result == OK) { // update total production amount in memory
						const product = this.memory.activeReaction ? this.memory.activeReaction.mineralType : 'ERROR';
						if (!this.memory.stats.totalProduction[product]) {
							this.memory.stats.totalProduction[product] = 0;
						}
						this.memory.stats.totalProduction[product] += LAB_REACTION_AMOUNT;
					} else {
						log.debug(`Couldn't run reaction for lab @ ${lab.pos.print}! Result: ${result}`);
					}
				}
			}
		}
		// Record stats
		this.stats();
	}

	visuals() {
		// _.forEach(this.reagentLabs, lab => Visualizer.circle(lab.pos, 'red'));
		// _.forEach(this.productLabs, lab => Visualizer.circle(lab.pos, 'blue'));
		// _.forEach(this.boostingLabs, lab => Visualizer.circle(lab.pos, 'purple'));
	}

	private stats(): void {
		Stats.log(`colonies.${this.colony.name}.evolutionChamber.totalProduction`, this.memory.stats.totalProduction);
		let labUsage = _.sum(this.productLabs, lab => lab.cooldown > 0 ? 1 : 0) / this.productLabs.length;
		this.memory.stats.avgUsage = rollingAverage(labUsage, this.memory.stats.avgUsage, LAB_USAGE_WINDOW);
		Stats.log(`colonies.${this.colony.name}.evolutionChamber.avgUsage`, this.memory.stats.avgUsage);
	}

}

