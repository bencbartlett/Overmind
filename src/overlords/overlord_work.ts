import {Overlord} from './Overlord';
import {Priority} from '../config/priorities';
import {WorkerSetup} from '../creepSetup/defaultSetups';
import {ColonyStage} from '../Colony';
import {profile} from '../lib/Profiler';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskRepair} from '../tasks/task_repair';
import {TaskBuild} from '../tasks/task_build';
import {TaskUpgrade} from '../tasks/task_upgrade';

@profile
export class WorkerOverlord extends Overlord {

	workers: Zerg[];
	room: Room;
	constructionSites: ConstructionSite[];
	repairStructures: Structure[];
	rechargeStructures: (StructureStorage | StructureTerminal | StructureContainer | StructureLink)[];

	constructor(colony: IColony, priority = Priority.Normal) {
		super(colony, 'worker', priority);
		this.workers = this.getCreeps('worker');
		this.constructionSites = this.room.constructionSites;
		this.repairStructures = _.filter(this.room.repairables, function (structure) {
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
											 ..._.map(this.room.sources,
													  source => this.colony.miningSites[source.id].output!)]);
	}

	spawn() {
		let constructionTicks = _.sum(_.map(this.constructionSites,
											site => site.progressTotal - site.progress)) / BUILD_POWER;
		let repairTicks = _.sum(_.map(this.repairStructures,
									  structure => structure.hitsMax - structure.hits)) / REPAIR_POWER;
		let workPartsPerWorker = _.filter(this.generateProtoCreep(new WorkerSetup()).body, part => part == WORK).length;
		let numWorkers = Math.ceil(2 * (constructionTicks + repairTicks) / (workPartsPerWorker * CREEP_LIFE_TIME));
		if (this.colony.stage == ColonyStage.Larva) { // Always want at least 1 worker before dedicated upgraders spawn
			numWorkers += 1;
		}
		this.wishlist(numWorkers, new WorkerSetup());
	}

	init() {
		this.spawn();
	}

	private repairActions(worker: Zerg) {
		let target = worker.pos.findClosestByRange(this.repairStructures);
		if (target) worker.task = new TaskRepair(target);
	}

	private buildActions(worker: Zerg) {
		// TODO: prioritize sites by type
		let target = worker.pos.findClosestByRange(this.constructionSites);
		if (target) worker.task = new TaskBuild(target);
	}

	private upgradeActions(worker: Zerg) {
		worker.task = new TaskUpgrade(this.room.controller!);
	}

	private rechargeActions(worker: Zerg) {
		let target = worker.pos.findClosestByRange(_.filter(this.rechargeStructures,
															structure => structure.energy > worker.carryCapacity));
		if (target) worker.task = new TaskWithdraw(target);
	}

	private handleWorker(worker: Zerg) {
		if (worker.carry.energy > 0) {
			if (this.repairStructures.length > 0) {
				this.repairActions(worker);
			} else if (this.constructionSites.length > 0) {
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