import {Overlord, ZergOptions} from '../Overlord';
import {Colony, ColonyStage, DEFCON} from '../../Colony';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {BuildPriorities, FortifyPriorities} from '../../priorities/priorities_structures';
import {$} from '../../caching/GlobalCache';
import {Task} from '../../tasks/Task';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {Roles, Setups} from '../../creepSetups/setups';
import {boostResources} from '../../resources/map_resources';
import {TerminalState_Rebuild} from '../../directives/terminalState/terminalState_rebuild';
import {minBy} from '../../utilities/utils';

/**
 * Spawns general-purpose workers, which maintain a colony, performing actions such as building, repairing, fortifying,
 * paving, and upgrading, when needed
 */
@profile
export class WorkerOverlord extends Overlord {

	workers: Zerg[];
	room: Room;
	repairStructures: Structure[];
	dismantleStructures: Structure[];
	fortifyBarriers: (StructureWall | StructureRampart)[];
	criticalBarriers: (StructureWall | StructureRampart)[];
	constructionSites: ConstructionSite[];
	nukeDefenseRamparts: StructureRampart[];
	nukeDefenseHitsRemaining: { [id: string]: number };

	static settings = {
		barrierHits         : {			// What HP to fortify barriers to at each RCL
			critical: 2500,
			1       : 3e+3,
			2       : 3e+3,
			3       : 1e+4,
			4       : 5e+4,
			5       : 1e+5,
			6       : 5e+5,
			7       : 1e+6,
			8       : 2e+7,
		},
		hitTolerance        : 100000, 	// allowable spread in HP
		fortifyDutyThreshold: 500000,	// ignore fortify duties until this amount of energy is present in the room
	};

	constructor(colony: Colony, priority = OverlordPriority.ownedRoom.work) {
		super(colony, 'worker', priority);
		// Compute barriers needing fortification or critical attention
		this.fortifyBarriers = $.structures(this, 'fortifyBarriers', () =>
			_.sortBy(_.filter(this.room.barriers, s =>
				s.hits < WorkerOverlord.settings.barrierHits[this.colony.level]
				&& this.colony.roomPlanner.barrierPlanner.barrierShouldBeHere(s.pos)
			), s => s.hits), 25);
		this.criticalBarriers = $.structures(this, 'criticalBarriers', () =>
			_.filter(this.fortifyBarriers,
					 barrier => barrier.hits < WorkerOverlord.settings.barrierHits.critical), 10);
		// Generate a list of structures needing repairing (different from fortifying except in critical case)
		this.repairStructures = $.structures(this, 'repairStructures', () =>
			_.filter(this.colony.repairables, structure => {
				if (structure.structureType == STRUCTURE_CONTAINER) {
					// only repair containers in owned room
					if (structure.pos.roomName == this.colony.name) {
						return structure.hits < 0.5 * structure.hitsMax;
					} else {
						return false;
					}
				} else {
					return structure.hits < structure.hitsMax;
				}
			}));
		this.dismantleStructures = [];

		let homeRoomName = this.colony.room.name;
		let defcon = this.colony.defcon;
		// Filter constructionSites to only build valid ones
		let room = this.colony.room as any;
		let level = this.colony.controller.level;
		this.constructionSites = _.filter(this.colony.constructionSites, function (site) {
			// If site will be more than max amount of a structure at current level, ignore (happens after downgrade)
			let structureAmount = room[site.structureType + 's'] ? room[site.structureType + 's'].length :
								  (room[site.structureType] ? 1 : 0);
			if (structureAmount >= CONTROLLER_STRUCTURES[site.structureType][level]) {
				return false;
			}
			if (defcon > DEFCON.safe) {
				// Only build non-road, non-container sites in the home room if defcon is unsafe
				return site.pos.roomName == homeRoomName &&
					   site.structureType != STRUCTURE_CONTAINER &&
					   site.structureType != STRUCTURE_ROAD;
			} else {
				// Build all non-container sites in outpost and all sites in room if defcon is safe
				if (site.pos.roomName != homeRoomName
					&& Cartographer.roomType(site.pos.roomName) == ROOMTYPE_CONTROLLER) {
					return site.structureType != STRUCTURE_CONTAINER &&
						   !(site.room && site.room.dangerousHostiles.length > 0);
				} else {
					return true;
				}
			}
		});

		// Nuke defense ramparts needing fortification
		this.nukeDefenseRamparts = [];
		this.nukeDefenseHitsRemaining = {};
		if (this.room.find(FIND_NUKES).length > 0) {
			for (let rampart of this.colony.room.ramparts) {
				let neededHits = this.neededRampartHits(rampart);
				if (rampart.hits < neededHits) {
					this.nukeDefenseRamparts.push(rampart);
					this.nukeDefenseHitsRemaining[rampart.id] = neededHits - rampart.hits;
				}
			}
		}

		// Spawn boosted workers if there is significant fortifying which needs to be done
		let opts: ZergOptions = {};
		let totalNukeDefenseHitsRemaining = _.sum(_.values(this.nukeDefenseHitsRemaining));
		let approximateRepairPowerPerLifetime = REPAIR_POWER * 50 / 3 * CREEP_LIFE_TIME;
		if (totalNukeDefenseHitsRemaining > 3 * approximateRepairPowerPerLifetime) {
			opts.boostWishlist = [boostResources.construct[3]];
		}

		// Register workers
		this.workers = this.zerg(Roles.worker, opts);
	}

	private neededRampartHits(rampart: StructureRampart): number {
		let neededHits = WorkerOverlord.settings.barrierHits[this.colony.level];
		for (let nuke of rampart.pos.lookFor(LOOK_NUKES)) {
			neededHits += 10e6;
		}
		for (let nuke of rampart.pos.findInRange(FIND_NUKES, 3)) {
			if (nuke.pos != rampart.pos) {
				neededHits += 5e6;
			}
		}
		return neededHits;
	}

	refresh() {
		super.refresh();
		$.refresh(this, 'repairStructures', 'dismantleStructures', 'fortifyBarriers', 'criticalBarriers',
				  'constructionSites', 'nukeDefenseRamparts');
	}

	init() {
		const setup = this.colony.level == 1 ? Setups.workers.early : Setups.workers.default;
		const workPartsPerWorker = setup.getBodyPotential(WORK, this.colony);
		let numWorkers: number;
		if (this.colony.stage == ColonyStage.Larva) {
			numWorkers = $.number(this, 'numWorkers', () => {
				// At lower levels, try to saturate the energy throughput of the colony
				const MAX_WORKERS = 10; // Maximum number of workers to spawn
				let energyMinedPerTick = _.sum(_.map(this.colony.miningSites, function (site) {
					const overlord = site.overlords.mine;
					const miningPowerAssigned = _.sum(overlord.miners, miner => miner.getActiveBodyparts(WORK));
					const saturation = Math.min(miningPowerAssigned / overlord.miningPowerNeeded, 1);
					return overlord.energyPerTick * saturation;
				}));
				let energyPerTickPerWorker = 1.1 * workPartsPerWorker; // Average energy per tick when working
				let workerUptime = 0.8;
				let numWorkers = Math.ceil(energyMinedPerTick / (energyPerTickPerWorker * workerUptime));
				return Math.min(numWorkers, MAX_WORKERS);
			});
		} else {
			if (this.colony.roomPlanner.memory.relocating) {
				// If relocating, maintain a maximum of workers
				numWorkers = 5;
			} else {
				numWorkers = $.number(this, 'numWorkers', () => {
					// At higher levels, spawn workers based on construction and repair that needs to be done
					const MAX_WORKERS = 5; // Maximum number of workers to spawn
					if (this.nukeDefenseRamparts.length > 0) {
						return MAX_WORKERS;
					}
					let buildTicks = _.sum(this.constructionSites,
										   site => Math.max(site.progressTotal - site.progress, 0)) / BUILD_POWER;
					let repairTicks = _.sum(this.repairStructures,
											structure => structure.hitsMax - structure.hits) / REPAIR_POWER;
					let paveTicks = _.sum(this.colony.rooms,
										  room => this.colony.roadLogistics.energyToRepave(room)) / 1; // repairCost=1
					let fortifyTicks = 0;
					if (this.colony.assets.energy > WorkerOverlord.settings.fortifyDutyThreshold) {
						fortifyTicks = 0.25 * _.sum(this.fortifyBarriers, barrier =>
							Math.max(0, WorkerOverlord.settings.barrierHits[this.colony.level]
										- barrier.hits)) / REPAIR_POWER;
					}
					// max constructionTicks for private server manually setting progress
					let numWorkers = Math.ceil(2 * (5 * buildTicks + repairTicks + paveTicks + fortifyTicks) /
											   (workPartsPerWorker * CREEP_LIFE_TIME));
					numWorkers = Math.min(numWorkers, MAX_WORKERS);
					if (this.colony.controller.ticksToDowngrade <= (this.colony.level >= 4 ? 10000 : 2000)) {
						numWorkers = Math.max(numWorkers, 1);
					}
					return numWorkers;
				});
			}
		}
		this.wishlist(numWorkers, setup);
	}

	private repairActions(worker: Zerg): boolean {
		let target = worker.pos.findClosestByMultiRoomRange(this.repairStructures);
		if (target) {
			worker.task = Tasks.repair(target);
			return true;
		} else {
			return false;
		}
	}

	private buildActions(worker: Zerg): boolean {
		let groupedSites = _.groupBy(this.constructionSites, site => site.structureType);
		for (let structureType of BuildPriorities) {
			if (groupedSites[structureType]) {
				let target = worker.pos.findClosestByMultiRoomRange(groupedSites[structureType]);
				if (target) {
					worker.task = Tasks.build(target);
					return true;
				}
			}
		}
		return false;
	}

	private dismantleActions(worker: Zerg): boolean {
		let targets = _.filter(this.dismantleStructures, s => (s.targetedBy || []).length < 3);
		let target = worker.pos.findClosestByMultiRoomRange(targets);
		if (target) {
			_.remove(this.dismantleStructures, s => s == target);
			worker.task = Tasks.dismantle(target);
			return true;
		} else {
			return false;
		}
	}

	// Find a suitable repair ordering of roads with a depth first search
	private buildPavingManifest(worker: Zerg, room: Room): Task | null {
		let energy = worker.carry.energy;
		let targetRefs: { [ref: string]: boolean } = {};
		let tasks: Task[] = [];
		let target: StructureRoad | undefined = undefined;
		let previousPos: RoomPosition | undefined = undefined;
		while (true) {
			if (energy <= 0) break;
			if (previousPos) {
				target = _.find(this.colony.roadLogistics.repairableRoads(room),
								road => road.hits < road.hitsMax && !targetRefs[road.id]
										&& road.pos.getRangeTo(previousPos!) <= 1);
			} else {
				target = _.find(this.colony.roadLogistics.repairableRoads(room),
								road => road.hits < road.hitsMax && !targetRefs[road.id]);
			}
			if (target) {
				previousPos = target.pos;
				targetRefs[target.id] = true;
				energy -= (target.hitsMax - target.hits) / REPAIR_POWER;
				tasks.push(Tasks.repair(target));
			} else {
				break;
			}
		}
		return Tasks.chain(tasks);
	}

	private pavingActions(worker: Zerg): boolean {
		let roomToRepave = this.colony.roadLogistics.workerShouldRepave(worker)!;
		this.colony.roadLogistics.registerWorkerAssignment(worker, roomToRepave);
		// Build a paving manifest
		let task = this.buildPavingManifest(worker, roomToRepave);
		if (task) {
			worker.task = task;
			return true;
		} else {
			return false;
		}
	}

	private fortifyActions(worker: Zerg, fortifyStructures = this.fortifyBarriers): boolean {
		let lowBarriers: (StructureWall | StructureRampart)[];
		let highestBarrierHits = _.max(_.map(fortifyStructures, structure => structure.hits));
		if (highestBarrierHits > WorkerOverlord.settings.hitTolerance) {
			// At high barrier HP, fortify only structures that are within a threshold of the lowest
			let lowestBarrierHits = _.min(_.map(fortifyStructures, structure => structure.hits));
			lowBarriers = _.filter(fortifyStructures, structure => structure.hits <= lowestBarrierHits +
																   WorkerOverlord.settings.hitTolerance);
		} else {
			// Otherwise fortify the lowest N structures
			let numBarriersToConsider = 5; // Choose the closest barrier of the N barriers with lowest hits
			lowBarriers = _.take(fortifyStructures, numBarriersToConsider);
		}
		let target = worker.pos.findClosestByMultiRoomRange(lowBarriers);
		if (target) {
			worker.task = Tasks.fortify(target);
			return true;
		} else {
			return false;
		}
	}

	private nukeFortifyActions(worker: Zerg, fortifyStructures = this.nukeDefenseRamparts): boolean {
		let target = minBy(fortifyStructures, rampart => {
			let structuresUnderRampart = rampart.pos.lookFor(LOOK_STRUCTURES);
			return _.min(_.map(structuresUnderRampart, structure => {
				let priority = _.findIndex(FortifyPriorities, sType => sType == structure.structureType);
				if (priority >= 0) { // if found
					return priority;
				} else { // not found
					return 999;
				}
			}));
		});
		if (target) {
			worker.task = Tasks.fortify(target);
			return true;
		} else {
			return false;
		}
	}

	private upgradeActions(worker: Zerg): boolean {
		// Sign controller if needed
		if ((!this.colony.controller.signedByMe && !this.colony.controller.signedByScreeps)) {
			worker.task = Tasks.signController(this.colony.controller);
			return true;
		}
		worker.task = Tasks.upgrade(this.room.controller!);
		return true;
	}

	private handleWorker(worker: Zerg) {
		if (worker.carry.energy > 0) {
			// Upgrade controller if close to downgrade
			if (this.colony.controller.ticksToDowngrade <= (this.colony.level >= 4 ? 10000 : 2000)) {
				if (this.upgradeActions(worker)) return;
			}
			// Repair damaged non-road non-barrier structures
			if (this.repairStructures.length > 0 && this.colony.defcon == DEFCON.safe) {
				if (this.repairActions(worker)) return;
			}
			// Fortify critical barriers
			if (this.criticalBarriers.length > 0) {
				if (this.fortifyActions(worker, this.criticalBarriers)) return;
			}
			// Build new structures
			if (this.constructionSites.length > 0) {
				if (this.buildActions(worker)) return;
			}
			// Build ramparts to block incoming nuke
			if (this.nukeDefenseRamparts.length > 0 && this.colony.terminalState != TerminalState_Rebuild) {
				if (this.nukeFortifyActions(worker, this.nukeDefenseRamparts)) return;
			}
			// Build and maintain roads
			if (this.colony.roadLogistics.workerShouldRepave(worker) && this.colony.defcon == DEFCON.safe) {
				if (this.pavingActions(worker)) return;
			}
			// Dismantle marked structures
			if (this.dismantleStructures.length > 0 && this.colony.defcon == DEFCON.safe) {
				if (this.dismantleActions(worker)) return;
			}
			// Fortify walls and ramparts
			if (this.fortifyBarriers.length > 0) {
				if (this.fortifyActions(worker, this.fortifyBarriers)) return;
			}
			// Upgrade controller if less than RCL8 or no upgraders
			if ((this.colony.level < 8 || this.colony.upgradeSite.overlord.upgraders.length == 0)
				&& this.colony.defcon == DEFCON.safe) {
				if (this.upgradeActions(worker)) return;
			}
		} else {
			// Acquire more energy
			let workerWithdrawLimit = this.colony.stage == ColonyStage.Larva ? 750 : 100;
			worker.task = Tasks.recharge(workerWithdrawLimit);
		}
	}

	run() {
		this.autoRun(this.workers, worker => this.handleWorker(worker),
					 worker => worker.flee(worker.room.fleeDefaults, {invalidateTask: true}));
	}
}
