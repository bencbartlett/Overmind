import {Overlord} from '../Overlord';
import {BuildPriorities} from '../../settings/priorities';
import {WorkerSetup} from '../../creepSetup/defaultSetups';
import {Colony, ColonyStage} from '../../Colony';
import {profile} from '../../lib/Profiler';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../priorities_overlords';

@profile
export class WorkerOverlord extends Overlord {

	workers: Zerg[];
	room: Room;
	repairStructures: Structure[];
	rechargeStructures: (StructureStorage | StructureTerminal | StructureContainer | StructureLink)[];
	fortifyStructures: (StructureWall | StructureRampart)[];
	settings: {
		barrierHits: { [rcl: number]: number };
		barrierLowHighHits: number;
		workerWithdrawLimit: number;
	};

	constructor(colony: Colony, priority = OverlordPriority.ownedRoom.work) {
		super(colony, 'worker', priority);
		this.workers = this.creeps('worker');
		this.rechargeStructures = _.compact([this.colony.storage!,
											 this.colony.terminal!,
											 this.colony.upgradeSite.input!,
											 ..._.map(this.colony.miningSites, site => site.output!)]);
		if (this.colony.hatchery && this.colony.hatchery.battery) {
			this.rechargeStructures.push(this.colony.hatchery.battery);
		}
		// Barrier settings
		this.settings = {
			barrierHits        : {
				1: 3000,
				2: 3000,
				3: 3000,
				4: 10000,
				5: 100000,
				6: 1000000,
				7: 10000000,
				8: 30000000,
			},
			barrierLowHighHits : 100000,
			workerWithdrawLimit: this.colony.stage == ColonyStage.Larva ? 750 : 100,
		};
		this.fortifyStructures = _.sortBy(_.filter(this.room.barriers,
												   s => s.hits < this.settings.barrierHits[this.colony.level]),
										  s => s.hits);
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
	}

	init() {
		let workPartsPerWorker = _.filter(this.generateProtoCreep(new WorkerSetup()).body, part => part == WORK).length;
		if (this.colony.stage == ColonyStage.Larva) {
			// At lower levels, try to saturate the energy throughput of the colony
			let MAX_WORKERS = 7; // Maximum number of workers to spawn
			let energyPerTick = _.sum(_.map(this.colony.miningSites, site => site.energyPerTick));
			let energyPerTickPerWorker = 1.1 * workPartsPerWorker; // Average energy per tick when workers are working
			let workerUptime = 0.8;
			let numWorkers = Math.ceil(energyPerTick / (energyPerTickPerWorker * workerUptime));
			this.wishlist(Math.min(numWorkers, MAX_WORKERS), new WorkerSetup());
		} else {
			// At higher levels, spawn workers based on construction and repair that needs to be done
			let MAX_WORKERS = 3; // Maximum number of workers to spawn
			let constructionTicks = _.sum(_.map(this.colony.constructionSites,
												site => site.progressTotal - site.progress)) / BUILD_POWER;
			let repairTicks = _.sum(_.map(this.repairStructures,
										  structure => structure.hitsMax - structure.hits)) / REPAIR_POWER;
			let fortifyTicks = 0.25 * _.sum(_.map(this.fortifyStructures,
												  barrier => this.settings.barrierHits[this.colony.level]
															 - barrier.hits)) / REPAIR_POWER;
			if (this.colony.storage!.energy < 500000) {
				fortifyTicks = 0; // Ignore fortification duties below this energy level
			}
			let numWorkers = Math.ceil(2 * (constructionTicks + repairTicks + fortifyTicks) /
									   (workPartsPerWorker * CREEP_LIFE_TIME));
			this.wishlist(Math.min(numWorkers, MAX_WORKERS), new WorkerSetup());
		}
	}

	private repairActions(worker: Zerg) {
		let target = worker.pos.findClosestByMultiRoomRange(this.repairStructures);
		if (target) worker.task = Tasks.repair(target);
	}

	private buildActions(worker: Zerg) {
		let groupedSites = _.groupBy(this.colony.constructionSites, site => site.structureType);
		for (let structureType of BuildPriorities) {
			if (groupedSites[structureType]) {
				// let ranges = _.map(groupedSites[structureType], site => worker.pos.getMultiRoomRangeTo(site.pos));
				// let target = groupedSites[structureType][_.indexOf(ranges, _.min(ranges))];
				let target = worker.pos.findClosestByMultiRoomRange(groupedSites[structureType]);
				if (target) {
					worker.task = Tasks.build(target);
					return;
				}
			}
		}
	}

	private pavingActions(worker: Zerg) {
		let roomToRepave = this.colony.roadLogistics.workerShouldRepave(worker)!;
		this.colony.roadLogistics.registerWorkerAssignment(worker, roomToRepave);
		let target = worker.pos.findClosestByMultiRoomRange(this.colony.roadLogistics.repairableRoads(roomToRepave));
		if (target) worker.task = Tasks.repair(target);
	}

	private fortifyActions(worker: Zerg) {
		let lowBarriers: (StructureWall | StructureRampart)[];
		let highestBarrierHits = _.max(_.map(this.fortifyStructures, structure => structure.hits));
		if (highestBarrierHits > this.settings.barrierLowHighHits) {
			// At high barrier HP, fortify only structures that are within a threshold of the lowest
			let lowestBarrierHits = _.min(_.map(this.fortifyStructures, structure => structure.hits));
			lowBarriers = _.filter(this.fortifyStructures, structure => structure.hits < lowestBarrierHits +
																		this.settings.barrierLowHighHits);
		} else {
			// Otherwise fortify the lowest N structures
			let numBarriersToConsider = 5; // Choose the closest barrier of the N barriers with lowest hits
			lowBarriers = _.take(this.fortifyStructures, numBarriersToConsider);
		}
		let target = worker.pos.findClosestByMultiRoomRange(lowBarriers);
		if (target) worker.task = Tasks.fortify(target);
	}

	private upgradeActions(worker: Zerg) {
		worker.task = Tasks.upgrade(this.room.controller!);
	}

	private rechargeActions(worker: Zerg) {
		let rechargeStructures = _.filter(this.rechargeStructures, s => s.energy > this.settings.workerWithdrawLimit);
		let target = worker.pos.findClosestByMultiRoomRange(rechargeStructures);
		if (target) worker.task = Tasks.withdraw(target);
	}

	private handleWorker(worker: Zerg) {
		if (worker.carry.energy > 0) {
			if (this.colony.controller.ticksToDowngrade <= 1000) {
				this.upgradeActions(worker);
			} else if (this.repairStructures.length > 0) {
				this.repairActions(worker);
			} else if (this.colony.roadLogistics.workerShouldRepave(worker)) {
				this.pavingActions(worker);
			} else if (this.colony.constructionSites.length > 0) {
				this.buildActions(worker);
			} else if (this.fortifyStructures.length > 0) {
				this.fortifyActions(worker);
			} else {
				this.upgradeActions(worker);
			}
		} else {
			this.rechargeActions(worker);
		}
	}

	run() {
		for (let worker of this.workers) {
			if (worker.isIdle) {
				this.handleWorker(worker);
			}
			worker.run();
			// let result = worker.run();
			// if (result != OK) {
			// 	// TODO: this is super expensive
			// 	// If you haven't done anything, try to repair something in range
			// 	let nearbyRepairables = _.sortBy(_.filter(this.room.repairables, s => worker.pos.getRangeTo(s) <= 3),
			// 									 s => s.hits);
			// 	let target = nearbyRepairables[0];
			// 	if (target) worker.repair(target);
			// }
		}
	}
}
