import {$} from '../caching/GlobalCache';
import {Colony} from '../Colony';
import {log} from '../console/log';
import {TerminalNetworkV2} from '../logistics/TerminalNetwork_v2';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';
import {Mem} from '../memory/Memory';
import {Pathing} from '../movement/Pathing';
import {Priority} from '../priorities/priorities';
import {profile} from '../profiler/decorator';
import {Abathur, Reaction} from '../resources/Abathur';
import {BOOST_PARTS, BOOST_TIERS, BoostType, REAGENTS} from '../resources/map_resources';
import {getPosFromBunkerCoord, reagentLabSpots} from '../roomPlanner/layouts/bunker';
import {Stats} from '../stats/stats';
import {randint} from '../utilities/random';
import {rightArrow} from '../utilities/stringConstants';
import {ema} from '../utilities/utils';
import {Visualizer} from '../visuals/Visualizer';
import {HiveCluster} from './_HiveCluster';

const LabStatus = {
	Idle             : 0,
	AcquiringMinerals: 1,
	LoadingLabs      : 2,
	Synthesizing     : 3,
	UnloadingLabs    : 4,
};

const LabStageTimeouts = {
	Idle             : Infinity,
	AcquiringMinerals: 50,
	LoadingLabs      : 50,
	Synthesizing     : 10000,
	UnloadingLabs    : 50,
};

const LAB_USAGE_WINDOW = 100;

interface EvolutionChamberMemory {
	status: number;
	statusTick: number;
	activeReaction: Reaction | undefined;
	suspendReactionsUntil?: number;
	stats: {
		totalProduction: { [resourceType: string]: number }
		avgUsage: number;
	};
}

const getDefaultEvolutionChamberMemory: () => EvolutionChamberMemory = () => ({
	status        : LabStatus.Idle,
	statusTick    : 0,
	activeReaction: undefined,
	stats         : {
		totalProduction: {},
		avgUsage       : 1,
	}
});

function neighboringLabs(pos: RoomPosition): StructureLab[] {
	return _.compact(_.map(pos.neighbors, neighbor => neighbor.lookForStructure(STRUCTURE_LAB))) as StructureLab[];
}

function labsAreEmpty(labs: StructureLab[]): boolean {
	return _.all(labs, lab => lab.mineralAmount == 0);
}

/**
 * The evolution chamber handles mineral production and boosting logic, handling resource supply for labs
 */
@profile
export class EvolutionChamber extends HiveCluster {

	terminal: StructureTerminal;							// The colony terminal
	terminalNetwork: TerminalNetworkV2;						// Reference to Overmind.terminalNetwork
	labs: StructureLab[];									// Colony labs
	reagentLabs: StructureLab[];
	productLabs: StructureLab[];
	boostingLabs: StructureLab[];
	transportRequests: TransportRequestGroup;				// Box for resource requests

	memory: EvolutionChamberMemory;

	private labReservations: {
		[labID: string]: { mineralType: string, amount: number }
	};
	private neededBoosts: { [boostType: string]: number };

	static settings = {
		sleepTime: 100
	};

	constructor(colony: Colony, terminal: StructureTerminal) {
		super(colony, terminal, 'evolutionChamber');
		this.memory = Mem.wrap(this.colony.memory, 'evolutionChamber', getDefaultEvolutionChamberMemory);
		// Register physical components
		this.terminal = terminal;
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetworkV2;
		this.labs = colony.labs;
		// Reserve some easily-accessible labs which are restricted not to be reagent labs
		const restrictedLabs = this.colony.bunker
							   ? _.filter(this.labs, lab => lab.pos.findInRange(this.colony.spawns, 1).length > 0)
							   : _.take(_.sortBy(this.labs, lab => Pathing.distance(this.terminal.pos, lab.pos)), 1);
		const getReagentLabs: () => StructureLab[] = () => {
			if (this.colony.bunker) {
				const reagentLabPositions = _.map(reagentLabSpots, coord => getPosFromBunkerCoord(coord, this.colony));
				const preferredReagentLabs = _.compact(_.map(reagentLabPositions,
															 pos => pos.lookForStructure(STRUCTURE_LAB)));
				if (preferredReagentLabs.length == 2) {
					return <StructureLab[]>preferredReagentLabs;
				}
			}
			// Reagent labs are range=2 from all other labs and are not a boosting lab
			const range2Labs = _.filter(this.labs, lab => _.all(this.labs, otherLab => lab.pos.inRangeTo(otherLab, 2)));
			const reagentLabCandidates = _.filter(range2Labs, lab => !_.any(restrictedLabs, l => l.id == lab.id));
			return _.take(_.sortBy(reagentLabCandidates, lab => -1 * neighboringLabs(lab.pos).length), 2);
		};
		this.reagentLabs = getReagentLabs();

		// Product labs are everything that isn't a reagent lab. (boostingLab can also be a productLab)
		this.productLabs = _.difference(this.labs, this.reagentLabs);
		// Boosting labs are product labs sorted by distance to terminal
		const unrestrictedBoostingLabs = _.sortBy(_.difference(this.productLabs, restrictedLabs),
												  lab => Pathing.distance(this.terminal.pos, lab.pos));
		this.boostingLabs = [...restrictedLabs, ...unrestrictedBoostingLabs];
		// This keeps track of reservations for boosting
		this.labReservations = {};
		// this.boostQueue = {};
		this.neededBoosts = {};
		if (this.colony.commandCenter && this.colony.layout == 'twoPart') { // TODO: deprecate soon
			// in two-part layout, evolution chamber shares a common request group with command center
			this.transportRequests = this.colony.commandCenter.transportRequests;
		} else {
			// otherwise (in bunker layout), it uses colony/hatchery transport requests
			this.transportRequests = this.colony.transportRequests;
		}
	}

	refresh() {
		this.memory = Mem.wrap(this.colony.memory, 'evolutionChamber', getDefaultEvolutionChamberMemory);
		$.refreshRoom(this);
		$.refresh(this, 'terminal', 'labs', 'boostingLabs', 'reagentLabs', 'productLabs');
		this.labReservations = {};
		this.neededBoosts = {};
	}

	spawnMoarOverlords() {
		// Evolution chamber is attended to by queens; overlord spawned at Hatchery
	}

	private initLabStatus(): void {
		if (!this.memory.activeReaction && this.memory.status != LabStatus.Idle) {
			log.warning(`Unexpected lack of active reaction at ${this.print}! Reverting to idle state.`);
			this.memory.status = LabStatus.Idle;
		}

		const reagents: ResourceConstant[] = this.memory.activeReaction
											 ? REAGENTS[this.memory.activeReaction.mineralType]
											 : [];
		const amount = this.memory.activeReaction ? this.memory.activeReaction.amount : Infinity;

		switch (this.memory.status) {
			case LabStatus.Idle:
				if (this.memory.activeReaction) {
					log.info(`${this.colony.print}: starting synthesis of ${reagents[0]} + ${reagents[1]} ` +
							 `${rightArrow} ${this.memory.activeReaction.mineralType}`);
					this.memory.status = LabStatus.AcquiringMinerals;
					this.memory.statusTick = Game.time;
				}
				break;

			case LabStatus.AcquiringMinerals: // "We acquire more mineralzzz"
				if (_.all(reagents, reagent => this.colony.assets[reagent] >= amount)) {
					this.memory.status = LabStatus.LoadingLabs;
					this.memory.statusTick = Game.time;
				}
				break;

			case LabStatus.LoadingLabs:
				if (_.all(this.reagentLabs,
						  lab => lab.mineralAmount >= amount && _.includes(reagents, lab.mineralType))) {
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
				const unloadLabs = _.filter(this.labs, lab => !this.labReservations[lab.id]);
				if (_.all(unloadLabs, lab => lab.mineralAmount == 0)) {
					this.memory.status = LabStatus.Idle;
					this.memory.statusTick = Game.time;
				}
				break;

			default:
				log.error(`Bad lab state at ${this.print}! State: ${this.memory.status}`);
				this.memory.status = LabStatus.Idle;
				this.memory.statusTick = Game.time;
				break;
		}
		this.statusTimeoutCheck();
	}

	private statusTimeoutCheck(): void {
		const ticksInStatus = Game.time - this.memory.statusTick;
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
				log.error(`Bad lab state at ${this.print}!`);
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
			// this.memory.reactionQueue = [];
		}
	}

	private registerReagentLabRequests(reagentLabs: [StructureLab, StructureLab]): void {
		if (this.memory.activeReaction) {
			const {mineralType, amount} = this.memory.activeReaction;
			const [ing1, ing2] = REAGENTS[mineralType];
			const [lab1, lab2] = reagentLabs;
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
			for (const lab of reagentLabs) {
				if (lab.mineralType && lab.mineralAmount > 0) {
					this.transportRequests.requestOutput(lab, Priority.Normal, {resourceType: lab.mineralType});
				}
			}
		}
	}

	private registerProductLabRequests(labs: StructureLab[]): void {
		if (this.memory.activeReaction) {
			const {mineralType, amount} = this.memory.activeReaction;
			for (const lab of labs) {
				const labHasWrongMineral = lab.mineralType != mineralType && lab.mineralAmount > 0;
				const labIsFull = lab.mineralAmount == lab.mineralCapacity;
				// Empty out incorrect minerals or if it's time to unload or if lab is full
				if ((this.memory.status == LabStatus.UnloadingLabs && lab.mineralAmount > 0) ||
					labHasWrongMineral || labIsFull) {
					this.transportRequests.requestOutput(lab, Priority.NormalLow, {resourceType: lab.mineralType!});
				}
			}
		} else {
			// Labs should be empty when no reaction process is currently happening
			for (const lab of labs) {
				if (lab.mineralType && lab.mineralAmount > 0) {
					this.transportRequests.requestOutput(lab, Priority.NormalLow, {resourceType: lab.mineralType});
				}
			}
		}
	}

	private registerBoosterLabRequests(labs: StructureLab[]): void {
		for (const lab of labs) {
			const {mineralType, amount} = this.labReservations[lab.id];
			// Empty out incorrect minerals
			if (lab.mineralType != mineralType && lab.mineralAmount > 0) {
				this.transportRequests.requestOutput(lab, Priority.High, {resourceType: lab.mineralType!});
			} else {
				this.transportRequests.requestInput(lab, Priority.High, {
					resourceType: <ResourceConstant>mineralType,
					amount      : amount - lab.mineralAmount
				});
			}
		}
	}

	private registerRequests(): void {
		// Don't care about labs if you can't spawn any creeps!
		if (this.colony.state.bootstrapping) {
			return;
		}

		// Separate product labs into actively boosting or ready for reaction
		const [boostingProductLabs, reactionProductLabs] = _.partition(this.productLabs,
																	   lab => this.labReservations[lab.id]);

		// Handle energy requests for labs with different priorities
		const boostingRefillLabs = _.filter(boostingProductLabs, lab => lab.energy < lab.energyCapacity);
		_.forEach(boostingRefillLabs, lab => this.transportRequests.requestInput(lab, Priority.High));
		const reactionRefillLabs = _.filter(reactionProductLabs, lab => lab.energy < lab.energyCapacity);
		_.forEach(reactionRefillLabs, lab => this.transportRequests.requestInput(lab, Priority.NormalLow));
		const reagentRefillLabs = _.filter(this.reagentLabs, lab => lab.energy < lab.energyCapacity);
		_.forEach(reagentRefillLabs, lab => this.transportRequests.requestInput(lab, Priority.NormalLow));

		// Request resources delivered to / withdrawn from each type of lab
		this.registerReagentLabRequests(this.reagentLabs as [StructureLab, StructureLab]);
		this.registerProductLabRequests(reactionProductLabs);
		this.registerBoosterLabRequests(boostingProductLabs);
	}

	// Lab mineral reservations ========================================================================================

	/* Reserves a product lab for boosting with a compound unrelated to production */
	private reserveLab(lab: StructureLab, resourceType: ResourceConstant, amount: number) {
		// _.remove(this.productLabs, productLab => productLab.id == lab.id); // This gets excluded in registerRequests
		this.labReservations[lab.id] = {mineralType: resourceType, amount: Math.min(amount, LAB_MINERAL_CAPACITY)};
	}

	/* Return the amount of a given resource necessary to fully boost a creep body */
	static requiredBoostAmount(body: BodyPartDefinition[], boostType: ResourceConstant): number {
		const existingBoostCounts = _.countBy(body, part => part.boost);
		const numPartsToBeBoosted = _.filter(body, part => part.type == BOOST_PARTS[boostType]).length;
		return LAB_BOOST_MINERAL * (numPartsToBeBoosted - (existingBoostCounts[boostType] || 0));
	}

	/**
	 * Returns the best boost of a given type (e.g. "tough") that the room can acquire a specified amount of
	 */
	bestBoostAvailable(boostType: BoostType, amount: number): ResourceConstant | undefined {
		if (PHASE != 'run') {
			log.error(`EvolutionChamber.bestBoostAvailable() must be called in the run() phase!`);
		}
		// let boostFilter: (resource: ResourceConstant) => boolean;
		// switch (boostType) {
		// 	case 'attack':
		// 		boostFilter = Abathur.isAttackBoost;
		// 		break;
		// 	case 'carry':
		// 		boostFilter = Abathur.isCarryBoost;
		// 		break;
		// 	case 'ranged':
		// 		boostFilter = Abathur.isRangedBoost;
		// 		break;
		// 	case 'heal':
		// 		boostFilter = Abathur.isHealBoost;
		// 		break;
		// 	case 'move':
		// 		boostFilter = Abathur.isMoveBoost;
		// 		break;
		// 	case 'tough':
		// 		boostFilter = Abathur.isToughBoost;
		// 		break;
		// 	case 'harvest':
		// 		boostFilter = Abathur.isHarvestBoost;
		// 		break;
		// 	case 'construct':
		// 		boostFilter = Abathur.isConstructBoost;
		// 		break;
		// 	case 'dismantle':
		// 		boostFilter = Abathur.isDismantleBoost;
		// 		break;
		// 	case 'upgrade':
		// 		boostFilter = Abathur.isUpgradeBoost;
		// 		break;
		// 	default:
		// 		log.error(`${this.print}: ${boostType} is not a valid boostType!`);
		// 		return;
		// }
		const boosts = BOOST_TIERS[boostType];
		for (const boost of [boosts.T3, boosts.T2, boosts.T1]) {
			if (this.colony.assets[boost] >= amount) {
				return boost;
			} else if (this.terminalNetwork.canObtainResource(this.colony, boost, amount)) {
				return boost;
			}
		}
		// If we get to here there's no available boosts of this type
		return undefined;
	}

	/* Request boosts sufficient to fully boost a given creep to be added to the boosting queue */
	requestBoosts(boosts: { [boostResource: string]: number }): void {
		// Add the required amount to the neededBoosts
		this.debug(`${JSON.stringify(boosts)} boosts requested!`);
		for (const boostResource in boosts) {
			const boostAmount = boosts[boostResource];
			// Here this.neededBoosts is describing what we want, not what we are going to load into labs, so it's okay
			// (and in fact better) to allow this to exceed LAB_MINERAL_CAPACITY so that terminalNetwork knows we
			// want a lot of this
			this.neededBoosts[boostResource] = (this.neededBoosts[boostResource] || 0) + boostAmount;
		}
	}

	private lockLabFromTerminalNetwork(lab: StructureLab) {
		if (lab.mineralType && lab.store[lab.mineralType]) {
			this.terminalNetwork.lockResource(this.colony, lab.mineralType, lab.store[lab.mineralType]);
		}
	}

	// Initialization and operation ====================================================================================

	init(): void { // This gets called after every Overlord.init() so you should have all your boost requests in already

		// Set boosting lab reservations and compute needed resources; needs to be done BEFORE initLabStatus()!
		for (const boost in this.neededBoosts) {
			if (this.neededBoosts[boost] == 0) continue;

			let boostLab: StructureLab | undefined;
			for (const id in this.labReservations) { // find a lab already reserved for this mineral type
				if (this.labReservations[id] && this.labReservations[id].mineralType == boost) {
					boostLab = deref(id) as StructureLab;
				}
			}
			if (!boostLab) { // otherwise choose the first unreserved product lab
				boostLab = _.find(this.boostingLabs, lab => !this.labReservations[lab.id]);
			}
			if (boostLab) {
				this.reserveLab(boostLab, <ResourceConstant>boost, this.neededBoosts[boost]);
			}
		}

		// Update the evo chamber status
		this.initLabStatus();

		// Register local transport requests
		this.registerRequests();

		// Request resources for boosting and lock them once you have them
		for (const boost in this.neededBoosts) {

			const product = this.memory.activeReaction ? this.memory.activeReaction.mineralType : undefined;
			const reagents = this.memory.activeReaction ? REAGENTS[this.memory.activeReaction.mineralType]
														: [undefined, undefined];

			let amountUnavailable = 0;
			if (boost == product) {
				_.forEach(this.productLabs, lab => {
					if (lab.mineralType == boost &&
						(!this.labReservations[lab.id] || this.labReservations[lab.id].mineralType != boost)) {
						amountUnavailable += lab.mineralAmount;
					}
				});
			} else if (boost == reagents[0]) {
				_.forEach(this.reagentLabs, lab => {
					if (lab.mineralType == boost &&
						(!this.labReservations[lab.id] || this.labReservations[lab.id].mineralType != boost)) {
						amountUnavailable += lab.mineralAmount;
					}
				});
			} else if (boost == reagents[1]) {
				_.forEach(this.reagentLabs, lab => {
					if (lab.mineralType == boost &&
						(!this.labReservations[lab.id] || this.labReservations[lab.id].mineralType != boost)) {
						amountUnavailable += lab.mineralAmount;
					}
				});
			}

			const amountNeeded = this.neededBoosts[boost] + amountUnavailable;
			if (amountNeeded > this.colony.assets[boost]) {
				this.debug(`Requesting boost from terminal network: ${this.neededBoosts[boost]} ${boost}`);
				this.terminalNetwork.requestResource(this.colony, <ResourceConstant>boost, amountNeeded);
			} else {
				this.debug(`Locking boost from terminal network: ${this.neededBoosts[boost]} ${boost}`);
				this.terminalNetwork.lockResource(this.colony, <ResourceConstant>boost, amountNeeded);
			}
		}

		// Request or lock resources from the terminal network
		if (this.memory.activeReaction) {

			const amount = this.memory.activeReaction.amount;
			const product = this.memory.activeReaction.mineralType;
			const reagents = REAGENTS[this.memory.activeReaction.mineralType];

			// Lock resources that are currently being used or produced
			switch (this.memory.status) {
				case LabStatus.Idle:
					break;
				case LabStatus.AcquiringMinerals:
					_.forEach(reagents, reagent => {
						if (this.colony.assets[reagent] < amount) {
							this.terminalNetwork.requestResource(this.colony, reagent, amount);
						} else {
							this.terminalNetwork.lockResource(this.colony, reagent, amount);
						}
					});
					break;
				case LabStatus.LoadingLabs:
					_.forEach(reagents, reagent => this.terminalNetwork.lockResource(this.colony, reagent, amount));
					break;
				case LabStatus.Synthesizing:
					_.forEach(this.reagentLabs, lab => {
						if (lab.mineralType == reagents[0] || lab.mineralType == reagents[1]) {
							this.lockLabFromTerminalNetwork(lab);
						}
					});
					_.forEach(this.productLabs, lab => {
						if (lab.mineralType == product) {
							this.lockLabFromTerminalNetwork(lab);
						}
					});
					break;
				case LabStatus.UnloadingLabs:
					_.forEach(this.labs, lab => {
						if (lab.mineralType == product ||
							lab.mineralType == reagents[0] ||
							lab.mineralType == reagents[1]) {
							this.lockLabFromTerminalNetwork(lab);
						}
					});
					break;
			}

		}

	}

	run(): void {

		if (this.memory.suspendReactionsUntil && Game.time > this.memory.suspendReactionsUntil) {
			delete this.memory.suspendReactionsUntil;
		}

		// Get an active reaction if you don't have one
		if (!this.memory.activeReaction && !this.memory.suspendReactionsUntil) {
			const nextReaction = Abathur.getNextReaction(this.colony);
			// There's a 1 tick delay between generating the reaction and being able to request the resources from
			// the terminal network. The reason for this is that this needs to be placed in the run() phase because
			// Abathur.getNextReaction() calls TerminalNetwork.canObtainResource(), which requires that knowledge of
			// the colony request states have already been registered in the init() phase. In any case, this adds an
			// inefficiency of like 1 tick in ~6000 for a T3 compound, so you can just deal with it. :P
			if (nextReaction) {
				this.memory.activeReaction = nextReaction;
			} else {
				const sleepTime = EvolutionChamber.settings.sleepTime + randint(0, 20);
				log.info(`${this.print}: no reaction available; sleeping for ${sleepTime} ticks.`);
				this.memory.suspendReactionsUntil = Game.time + sleepTime;
			}
		}

		// Run the reactions
		if (this.memory.status == LabStatus.Synthesizing) {
			const [lab1, lab2] = this.reagentLabs;
			for (const lab of this.productLabs) {
				if (lab.cooldown == 0 && !this.labReservations[lab.id]) {
					const result = lab.runReaction(lab1, lab2);
					if (result == OK) { // update total production amount in memory
						const product = this.memory.activeReaction ? this.memory.activeReaction.mineralType : 'ERROR';
						if (!this.memory.stats.totalProduction[product]) {
							this.memory.stats.totalProduction[product] = 0;
						}
						this.memory.stats.totalProduction[product] += LAB_REACTION_AMOUNT;
					} else {
						log.warning(`${this.print}: couldn't run reaction for lab @ ${lab.pos.print}! (${result})`);
					}
				}
			}
		}
		// Record stats
		this.stats();
	}

	private drawLabReport(coord: Coord): Coord {
		let {x, y} = coord;
		const height = 2;
		const titleCoords = Visualizer.section(`${this.colony.name} Evolution Chamber`,
											   {x, y, roomName: this.room.name}, 9.5, height + .1);
		const boxX = titleCoords.x;
		y = titleCoords.y + 0.25;

		let status: string;
		switch (this.memory.status) {
			case LabStatus.Idle:
				status = 'IDLE';
				break;
			case LabStatus.AcquiringMinerals:
				status = 'acquire minerals';
				break;
			case LabStatus.LoadingLabs:
				status = 'loading labs';
				break;
			case LabStatus.Synthesizing:
				status = 'synthesizing';
				break;
			case LabStatus.UnloadingLabs:
				status = 'unloading labs';
				break;
			default:
				status = 'INVALID';
				break;
		}

		const activeReaction = this.memory.activeReaction;
		const mineral = activeReaction ? activeReaction.mineralType : 'NONE';

		Visualizer.text(`Status: ${status}`, {x: boxX, y: y, roomName: this.room.name});
		y += 1;
		if (this.memory.status == LabStatus.Synthesizing && activeReaction) {
			const amountDone = _.sum(_.map(this.productLabs,
										   lab => lab.mineralType == activeReaction!.mineralType ? lab.mineralAmount : 0));
			Visualizer.text(activeReaction.mineralType, {x: boxX, y: y, roomName: this.room.name});
			Visualizer.barGraph([amountDone, activeReaction.amount],
								{x: boxX + 4, y: y, roomName: this.room.name}, 5);
			y += 1;
		} else {
			Visualizer.text(`Active reaction: ${mineral}`, {x: boxX, y: y, roomName: this.room.name});
			y += 1;
		}
		return {x: x, y: y + .25};
	}

	visuals(coord: Coord): Coord {
		const vis = this.room.visual;
		// Lab visuals
		for (const lab of this.labs) {
			if (lab.mineralType) {
				vis.resource(lab.mineralType, lab.pos.x, lab.pos.y);
			}
		}
		// Draw lab report
		return this.drawLabReport(coord);
	}

	private stats(): void {
		// Stats.log(`colonies.${this.colony.name}.evolutionChamber.totalProduction`, this.memory.stats.totalProduction);
		const labUsage = _.sum(this.productLabs, lab => lab.cooldown > 0 ? 1 : 0) / this.productLabs.length;
		this.memory.stats.avgUsage = ema(labUsage, this.memory.stats.avgUsage, LAB_USAGE_WINDOW);
		Stats.log(`colonies.${this.colony.name}.evolutionChamber.avgUsage`, this.memory.stats.avgUsage);
	}

}

