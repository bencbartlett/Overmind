import {Overlord} from '../Overlord';
import {Colony, ColonyStage, DEFCON} from '../../Colony';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {CreepSetup} from '../CreepSetup';
import {BuildPriorities} from '../../priorities/priorities_structures';
import {maxBy, minMax} from '../../utilities/utils';
import {isResource} from '../../declarations/typeGuards';

export const WorkerSetup = new CreepSetup('worker', {
	pattern  : [WORK, CARRY, MOVE],
	sizeLimit: Infinity,
});

const WorkerEarlySetup = new CreepSetup('worker', {
	pattern  : [WORK, CARRY, MOVE, MOVE],
	sizeLimit: Infinity,
});

type rechargeObjectType = StructureStorage
	| StructureTerminal
	| StructureContainer
	| StructureLink
	| Tombstone
	| Resource;

@profile
export class WorkerOverlord extends Overlord {

	workers: Zerg[];
	room: Room;
	repairStructures: Structure[];
	dismantleStructures: Structure[];
	rechargeObjects: rechargeObjectType[];
	fortifyStructures: (StructureWall | StructureRampart)[];
	constructionSites: ConstructionSite[];
	nukeDefenseRamparts: StructureRampart[];

	static settings = {
		barrierHits       : {
			1: 3000,
			2: 3000,
			3: 3000,
			4: 10000,
			5: 100000,
			6: 1000000,
			7: 10000000,
			8: 30000000,
		},
		barrierLowHighHits: 100000,
	};

	constructor(colony: Colony, priority = OverlordPriority.ownedRoom.work) {
		super(colony, 'worker', priority);
		this.workers = this.creeps(WorkerSetup.role);
		this.rechargeObjects = [];
		// Fortification structures
		this.fortifyStructures = _.sortBy(_.filter(this.room.barriers, s =>
			s.hits < WorkerOverlord.settings.barrierHits[this.colony.level]), s => s.hits);
		// Generate a list of structures needing repairing (different from fortifying except in critical case)
		this.repairStructures = _.filter(this.colony.repairables, function (structure) {
			if (structure.structureType == STRUCTURE_CONTAINER) {
				return structure.hits < 0.5 * structure.hitsMax;
			} else {
				return structure.hits < structure.hitsMax;
			}
		});
		let criticalHits = 1000; // Fortifying changes to repair status at this point
		let criticalBarriers = _.filter(this.fortifyStructures, s => s.hits <= criticalHits);
		this.repairStructures = this.repairStructures.concat(criticalBarriers);

		this.dismantleStructures = [];

		let homeRoomName = this.colony.room.name;
		let defcon = this.colony.defcon;
		// Filter constructionSites to only build valid ones
		let roomStructureAmounts = _.mapValues(this.colony.room.structures, s => s.length) as { [type: string]: number };
		let level = this.colony.controller.level;
		this.constructionSites = _.filter(this.colony.constructionSites, function (site) {
			// If site will be more than max amount of a structure at current level, ignore (happens after downgrade)
			if (roomStructureAmounts[site.structureType] + 1 > CONTROLLER_STRUCTURES[site.structureType][level]) {
				return false;
			}
			if (defcon > DEFCON.safe) {
				// Only build non-road, non-container sites in the home room if defcon is unsafe
				return site.pos.roomName == homeRoomName &&
					   site.structureType != STRUCTURE_CONTAINER &&
					   site.structureType != STRUCTURE_ROAD;
			} else {
				// Build all non-container sites in outpost and all sites in room if defcon is safe
				if (site.pos.roomName != homeRoomName) {
					return site.structureType != STRUCTURE_CONTAINER &&
						   !(site.room && site.room.dangerousHostiles.length > 0);
				} else {
					return true;
				}
			}
		});
		// Nuke defense response
		// this.nukeDefenseSites = _.filter(this.colony.room.constructionSites,
		// 								 site => site.pos.findInRange(FIND_NUKES, 3).length > 0);
		// let nukeRamparts = _.filter(this.colony.room.ramparts,
		// 							rampart => rampart.pos.findInRange(FIND_NUKES, 3).length > 0);
		// Nuke defense ramparts needing fortification
		this.nukeDefenseRamparts = _.filter(this.colony.room.ramparts, function (rampart) {
			if (rampart.pos.lookFor(LOOK_NUKES).length > 0) {
				return rampart.hits < 10000000 + 10000;
			} else if (rampart.pos.findInRange(FIND_NUKES, 3).length > 0) {
				return rampart.hits < 5000000 + 10000;
			} else {
				return false;
			}
		});
	}

	init() {
		// In case colony just started up, don't spawn workers until colony has something you can withdraw from
		if (_.compact(_.map(this.colony.miningSites, site => site.output)).length == 0) {
			return;
		}
		let setup = this.colony.stage == ColonyStage.Larva ? WorkerEarlySetup : WorkerSetup;
		let workPartsPerWorker = _.filter(this.generateProtoCreep(setup).body, part => part == WORK).length;
		if (this.colony.stage == ColonyStage.Larva) {
			// At lower levels, try to saturate the energy throughput of the colony
			const MAX_WORKERS = 7; // Maximum number of workers to spawn
			let energyPerTick = _.sum(_.map(this.colony.miningSites, site => site.energyPerTick));
			let energyPerTickPerWorker = 1.1 * workPartsPerWorker; // Average energy per tick when workers are working
			let workerUptime = 0.8;
			let numWorkers = Math.ceil(energyPerTick / (energyPerTickPerWorker * workerUptime));
			this.wishlist(Math.min(numWorkers, MAX_WORKERS), setup);
		} else {
			// At higher levels, spawn workers based on construction and repair that needs to be done
			const MAX_WORKERS = 4; // Maximum number of workers to spawn
			let constructionTicks = _.sum(_.map(this.colony.constructionSites,
												site => Math.max(site.progressTotal - site.progress, 0)))
									/ BUILD_POWER; // Math.max for if you manually set progress on private server
			let repairTicks = _.sum(_.map(this.repairStructures,
										  structure => structure.hitsMax - structure.hits)) / REPAIR_POWER;
			let fortifyTicks = 0.25 * _.sum(_.map(this.fortifyStructures,
												  barrier => WorkerOverlord.settings.barrierHits[this.colony.level]
															 - barrier.hits)) / REPAIR_POWER;
			if (this.colony.storage!.energy < 500000) {
				fortifyTicks = 0; // Ignore fortification duties below this energy level
			}
			let numWorkers = Math.ceil(2 * (constructionTicks + repairTicks + fortifyTicks) /
									   (workPartsPerWorker * CREEP_LIFE_TIME));
			this.wishlist(Math.min(numWorkers, MAX_WORKERS), setup);
		}
	}

	private repairActions(worker: Zerg) {
		let target = worker.pos.findClosestByMultiRoomRange(this.repairStructures);
		if (target) worker.task = Tasks.repair(target);
	}

	private buildActions(worker: Zerg) {
		let groupedSites = _.groupBy(this.constructionSites, site => site.structureType);
		for (let structureType of BuildPriorities) {
			if (groupedSites[structureType]) {
				let target = worker.pos.findClosestByMultiRoomRange(groupedSites[structureType]);
				if (target) {
					worker.task = Tasks.build(target);
					return;
				}
			}
		}
	}

	private dismantleActions(worker: Zerg) {
		let targets = _.filter(this.dismantleStructures, s => (s.targetedBy || []).length < 3);
		let target = worker.pos.findClosestByMultiRoomRange(targets);
		if (target) {
			_.remove(this.dismantleStructures, s => s == target);
			worker.task = Tasks.dismantle(target);
		}
	}

	private pavingActions(worker: Zerg) {
		let roomToRepave = this.colony.roadLogistics.workerShouldRepave(worker)!;
		this.colony.roadLogistics.registerWorkerAssignment(worker, roomToRepave);
		let target = worker.pos.findClosestByMultiRoomRange(this.colony.roadLogistics.repairableRoads(roomToRepave));
		if (target) worker.task = Tasks.repair(target);
	}

	private fortifyActions(worker: Zerg, fortifyStructures = this.fortifyStructures) {
		let lowBarriers: (StructureWall | StructureRampart)[];
		let highestBarrierHits = _.max(_.map(fortifyStructures, structure => structure.hits));
		if (highestBarrierHits > WorkerOverlord.settings.barrierLowHighHits) {
			// At high barrier HP, fortify only structures that are within a threshold of the lowest
			let lowestBarrierHits = _.min(_.map(fortifyStructures, structure => structure.hits));
			lowBarriers = _.filter(fortifyStructures, structure => structure.hits < lowestBarrierHits +
																   WorkerOverlord.settings.barrierLowHighHits);
		} else {
			// Otherwise fortify the lowest N structures
			let numBarriersToConsider = 5; // Choose the closest barrier of the N barriers with lowest hits
			lowBarriers = _.take(fortifyStructures, numBarriersToConsider);
		}
		let target = worker.pos.findClosestByMultiRoomRange(lowBarriers);
		if (target) worker.task = Tasks.fortify(target);
	}

	private upgradeActions(worker: Zerg) {
		// Sign controller if needed
		if ((!this.colony.controller.signedByMe && !this.colony.controller.signedByScreeps)) {
			worker.task = Tasks.signController(this.colony.controller);
			return;
		}
		worker.task = Tasks.upgrade(this.room.controller!);
	}

	private rechargeActions(worker: Zerg) {
		// Calculate recharge objects if needed (can't be placed in constructor because instantiation order
		if (this.rechargeObjects.length == 0) {
			let workerWithdrawLimit = this.colony.stage == ColonyStage.Larva ? 750 : 100;
			let rechargeObjects = _.compact([this.colony.storage!,
											 this.colony.terminal!,
											 this.colony.hatchery ? this.colony.hatchery.battery : undefined,
											 this.colony.upgradeSite.battery!,
											 ...(this.colony.room.drops[RESOURCE_ENERGY] || []),
											 ..._.map(this.colony.miningSites, site => site.output!),
											 ...this.colony.tombstones]) as rechargeObjectType[];
			this.rechargeObjects = _.filter(rechargeObjects, obj => isResource(obj) ? obj.amount > 0 : obj.energy > 0);
		}
		// Choose the target to maximize your energy gain subject to other targeting workers
		let target = maxBy(this.rechargeObjects, function (obj) {
			let amount: number;
			if (isResource(obj)) {
				amount = obj.amount;
			} else {
				amount = obj.energy;
			}
			let otherTargetingWorkers = _.map(obj.targetedBy, name => Game.zerg[name]);
			let resourceOutflux = _.sum(_.map(otherTargetingWorkers,
											  other => other.carryCapacity - _.sum(other.carry)));
			amount = minMax(amount - resourceOutflux, 0, worker.carryCapacity);
			return amount / (worker.pos.getMultiRoomRangeTo(obj.pos) + 1);
		});
		if (target) {
			if (isResource(target)) {
				worker.task = Tasks.pickup(target);
			} else {
				worker.task = Tasks.withdraw(target);
			}
		} else {
			// Harvest from a source if there is no recharge target available
			let availableSources = _.filter(this.room.sources,
											s => s.energy > 0 && s.pos.availableNeighbors().length > 0);
			let target = worker.pos.findClosestByMultiRoomRange(availableSources);
			if (target) worker.task = Tasks.harvest(target);
		}
	}

	private handleWorker(worker: Zerg) {
		if (worker.carry.energy > 0) {
			// Upgrade controller if close to downgrade
			if (this.colony.controller.ticksToDowngrade <= 1000) {
				this.upgradeActions(worker);
			}
			// Repair damaged non-road non-barrier structures
			else if (this.repairStructures.length > 0) {
				this.repairActions(worker);
			}
			// Build new structures
			else if (this.constructionSites.length > 0) {
				this.buildActions(worker);
			}
			// Build ramparts to block incoming nuke
			else if (this.nukeDefenseRamparts.length > 0) {
				this.fortifyActions(worker, this.nukeDefenseRamparts);
			}
			// Build and maintain roads
			else if (this.colony.roadLogistics.workerShouldRepave(worker) && this.colony.defcon == DEFCON.safe) {
				this.pavingActions(worker);
			}
			// Dismantle marked structures
			else if (this.dismantleStructures.length > 0 && this.colony.defcon == DEFCON.safe) {
				this.dismantleActions(worker);
			}
			// Fortify walls and ramparts
			else if (this.fortifyStructures.length > 0) {
				this.fortifyActions(worker);
			}
			// Upgrade controller if less than RCL8 or no upgraders
			else if (this.colony.level < 8 || this.colony.upgradeSite.overlord.upgraders.length == 0) {
				this.upgradeActions(worker);
			}
		} else {
			// Acquire more energy
			this.rechargeActions(worker);
		}
	}

	run() {
		for (let worker of this.workers) {
			if (worker.isIdle) {
				this.handleWorker(worker);
			}
			worker.run();
		}
	}
}
