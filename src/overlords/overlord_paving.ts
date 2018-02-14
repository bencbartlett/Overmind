// import {Overlord} from './Overlord';
// import {BuildPriorities, Priority} from '../config/priorities';
// import {WorkerSetup} from '../creepSetup/defaultSetups';
// import {Colony, ColonyStage} from '../Colony';
// import {profile} from '../lib/Profiler';
// import {Zerg} from '../Zerg';
// import {Tasks} from '../tasks/Tasks';
//
// @profile
// export class PavingOverlord extends Overlord {
//
// 	workers: Zerg[];
// 	room: Room;
// 	repairStructures: Structure[];
// 	rechargeStructures: (StructureStorage | StructureTerminal | StructureContainer | StructureLink)[];
// 	fortifyStructures: (StructureWall | StructureRampart)[];
// 	settings: {
// 		barrierHits: { [rcl: number]: number };
// 		workerWithdrawLimit: number;
// 	};
//
// 	constructor(colony: Colony, priority = Priority.Normal) {
// 		super(colony, 'paving', priority);
// 		this.workers = this.creeps('paver');
// 		this.rechargeStructures = _.compact([this.colony.storage!,
// 											 this.colony.terminal!,
// 											 this.colony.upgradeSite.input!,
// 											 ..._.map(this.colony.miningSites, site => site.output!)]);
// 		// Barrier settings
// 		this.settings = {
// 			barrierHits        : {
// 				1: 3000,
// 				2: 3000,
// 				3: 3000,
// 				4: 10000,
// 				5: 100000,
// 				6: 1000000,
// 				7: 10000000,
// 				8: 30000000,
// 			},
// 			workerWithdrawLimit: this.colony.stage == ColonyStage.Larva ? 750 : 100,
// 		};
// 		this.fortifyStructures = _.sortBy(_.filter(this.room.barriers,
// 												   s => s.hits < this.settings.barrierHits[this.colony.level]),
// 										  s => s.hits);
// 		// Generate a list of structures needing repairing (different from fortifying except in critical case)
// 		this.repairStructures = _.filter(this.colony.repairables, function (structure) {
// 			if (structure.structureType == STRUCTURE_ROAD) {
// 				return structure.hits < 0.75 * structure.hitsMax;
// 			} else if (structure.structureType == STRUCTURE_CONTAINER) {
// 				return structure.hits < 0.75 * structure.hitsMax;
// 			} else {
// 				return structure.hits < structure.hitsMax;
// 			}
// 		});
// 		let criticalHits = 1000; // Fortifying changes to repair status at this point
// 		let criticalBarriers = _.filter(this.fortifyStructures, s => s.hits <= criticalHits);
// 		this.repairStructures = this.repairStructures.concat(criticalBarriers);
// 	}
//
// 	spawn() {
// 		let workPartsPerWorker = _.filter(this.generateProtoCreep(new WorkerSetup()).body, part => part == WORK).length;
// 		if (this.colony.stage == ColonyStage.Larva) {
// 			// At lower levels, try to saturate the energy throughput of the colony
// 			let MAX_WORKERS = 10; // Maximum number of workers to spawn
// 			let energyPerTick = _.sum(_.map(this.colony.miningSites, site => site.energyPerTick));
// 			let energyPerTickPerWorker = 1.1 * workPartsPerWorker; // Average energy per tick when workers are working
// 			let workerUptime = 0.8;
// 			let numWorkers = Math.ceil(energyPerTick / (energyPerTickPerWorker * workerUptime));
// 			this.wishlist(Math.min(numWorkers, MAX_WORKERS), new WorkerSetup());
// 		} else {
// 			// At higher levels, spawn workers based on construction and repair that needs to be done
// 			let MAX_WORKERS = 5; // Maximum number of workers to spawn
// 			let constructionTicks = _.sum(_.map(this.colony.constructionSites,
// 												site => site.progressTotal - site.progress)) / BUILD_POWER;
// 			let repairTicks = _.sum(_.map(this.repairStructures,
// 										  structure => structure.hitsMax - structure.hits)) / REPAIR_POWER;
// 			let numWorkers = Math.ceil(3 * (constructionTicks + repairTicks) /
// 									   (workPartsPerWorker * CREEP_LIFE_TIME));
// 			this.wishlist(Math.min(numWorkers, MAX_WORKERS), new WorkerSetup());
// 		}
// 	}
//
// 	init() {
// 		this.spawn();
// 	}
//
// 	private repairActions(worker: Zerg) {
// 		let target = worker.pos.findClosestByMultiRoomRange(this.repairStructures);
// 		if (target) worker.task = Tasks.repair(target);
// 	}
//
// 	private buildActions(worker: Zerg) {
// 		let groupedSites = _.groupBy(this.colony.constructionSites, site => site.structureType);
// 		for (let structureType of BuildPriorities) {
// 			if (groupedSites[structureType]) {
// 				// let ranges = _.map(groupedSites[structureType], site => worker.pos.getMultiRoomRangeTo(site.pos));
// 				// let target = groupedSites[structureType][_.indexOf(ranges, _.min(ranges))];
// 				let target = worker.pos.findClosestByMultiRoomRange(groupedSites[structureType]);
// 				if (target) {
// 					worker.task = Tasks.build(target);
// 					return;
// 				}
// 			}
// 		}
// 	}
//
// 	private pavingActions(worker: Zerg) {
// 		// TODO
// 	}
//
// 	private fortifyActions(worker: Zerg) {
// 		let numBarriersToConsider = 5; // Choose the closest barrier of the N barriers with lowest hits
// 		let lowHitBarriers = _.take(this.fortifyStructures, numBarriersToConsider);
// 		let target = worker.pos.findClosestByMultiRoomRange(lowHitBarriers);
// 		if (target) worker.task = Tasks.fortify(target);
// 	}
//
// 	private upgradeActions(worker: Zerg) {
// 		worker.task = Tasks.upgrade(this.room.controller!);
// 	}
//
// 	private rechargeActions(worker: Zerg) {
// 		let rechargeStructures = _.filter(this.rechargeStructures, s => s.energy > this.settings.workerWithdrawLimit);
// 		let target = worker.pos.findClosestByMultiRoomRange(rechargeStructures);
// 		if (target) worker.task = Tasks.withdraw(target);
// 	}
//
// 	private handleWorker(worker: Zerg) {
// 		if (worker.carry.energy > 0) {
// 			if (this.colony.controller.ticksToDowngrade <= 1000) {
// 				this.upgradeActions(worker);
// 			} else if (this.repairStructures.length > 0) {
// 				this.repairActions(worker);
// 			} else if (this.colony.constructionSites.length > 0) {
// 				this.buildActions(worker);
// 			} else if (this.fortifyStructures.length > 0) {
// 				this.fortifyActions(worker);
// 			} else {
// 				this.upgradeActions(worker);
// 			}
// 		} else {
// 			this.rechargeActions(worker);
// 		}
// 	}
//
// 	run() {
// 		for (let worker of this.workers) {
// 			if (worker.isIdle) {
// 				this.handleWorker(worker);
// 			}
// 			let result = worker.run();
// 			if (result != OK) {
// 				// TODO: this is super expensive
// 				// If you haven't done anything, try to repair something in range
// 				let nearbyRepairables = _.sortBy(_.filter(this.room.repairables, s => worker.pos.getRangeTo(s) <= 3),
// 												 s => s.hits);
// 				let target = nearbyRepairables[0];
// 				if (target) worker.repair(target);
// 			}
// 		}
// 	}
// }