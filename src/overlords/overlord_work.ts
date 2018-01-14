import {Overlord} from './Overlord';
import {BuildPriorities, Priority} from '../config/priorities';
import {WorkerSetup} from '../creepSetup/defaultSetups';
import {Colony, ColonyStage} from '../Colony';
import {profile} from '../lib/Profiler';
import {Zerg} from '../Zerg';
import {Tasks} from '../tasks/Tasks';

@profile
export class WorkerOverlord extends Overlord {

	workers: Zerg[];
	room: Room;
	repairStructures: Structure[];
	rechargeStructures: (StructureStorage | StructureTerminal | StructureContainer | StructureLink)[];

	constructor(colony: Colony, priority = Priority.NormalHigh) {
		super(colony, 'worker', priority);
		this.workers = this.creeps('worker');
		this.repairStructures = _.filter(this.colony.repairables, function (structure) {
			if (structure.structureType == STRUCTURE_ROAD) {
				return structure.hits < 0.7 * structure.hitsMax;
			} else if (structure.structureType == STRUCTURE_CONTAINER) {
				return structure.hits < 0.7 * structure.hitsMax;
			} else {
				return structure.hits < structure.hitsMax;
			}
		});
		this.rechargeStructures = _.compact([this.colony.storage!,
											 this.colony.terminal!,
											 this.colony.upgradeSite.input!,
											 ..._.map(this.room.sources,
													  source => this.colony.miningSites[source.id].output!)]);
	}

	spawn() {
		let workPartsPerWorker = _.filter(this.generateProtoCreep(new WorkerSetup()).body, part => part == WORK).length;
		if (this.colony.stage == ColonyStage.Larva) {
			// At lower levels, try to saturate the energy throughput of the colony
			let energyPerTick = _.sum(_.map(this.colony.miningSites, site => site.energyPerTick));
			let energyPerTickPerWorker = 1.1 * workPartsPerWorker; // Average energy per tick when workers are working
			let workerUptime = 0.5;
			let numWorkers = Math.ceil(energyPerTick / (energyPerTickPerWorker * workerUptime));
			this.wishlist(numWorkers, new WorkerSetup());
		} else {
			// At higher levels, spawn workers based on construction and repair that needs to be done
			let constructionTicks = _.sum(_.map(this.colony.constructionSites,
												site => site.progressTotal - site.progress)) / BUILD_POWER;
			let repairTicks = _.sum(_.map(this.repairStructures,
										  structure => structure.hitsMax - structure.hits)) / REPAIR_POWER;
			let numWorkers = Math.ceil(2 * (constructionTicks + repairTicks) /
									   (workPartsPerWorker * CREEP_LIFE_TIME));
			this.wishlist(numWorkers, new WorkerSetup());
		}
	}

	init() {
		this.spawn();
	}

	private repairActions(worker: Zerg) {
		let target = worker.pos.findClosestByRange(this.repairStructures);
		if (target) worker.task = Tasks.repair(target);
	}

	private buildActions(worker: Zerg) {
		let groupedSites = _.groupBy(this.colony.constructionSites, site => site.structureType);
		for (let structureType of BuildPriorities) {
			if (groupedSites[structureType]) {
				let ranges = _.map(groupedSites[structureType], site => worker.pos.getMultiRoomRangeTo(site.pos));
				let target = groupedSites[structureType][_.indexOf(ranges, _.min(ranges))];
				if (target) {
					worker.task = Tasks.build(target);
					return;
				}
			}
		}
	}

	private pavingActions(worker: Zerg) {
		// TODO
	}

	private upgradeActions(worker: Zerg) {
		worker.task = Tasks.upgrade(this.room.controller!);
	}

	private rechargeActions(worker: Zerg) {
		let target = worker.pos.findClosestByRange(_.filter(this.rechargeStructures,
															structure => structure.energy > worker.carryCapacity));
		if (target) worker.task = Tasks.withdraw(target);
	}

	private handleWorker(worker: Zerg) {
		if (worker.carry.energy > 0) {
			if (this.repairStructures.length > 0) {
				this.repairActions(worker);
			} else if (this.colony.constructionSites.length > 0) {
				this.buildActions(worker);
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
		}
	}
}