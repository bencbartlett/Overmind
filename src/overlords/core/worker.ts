import {Overlord} from '../Overlord';
import {Colony, ColonyStage, DEFCON} from '../../Colony';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {BuildPriorities} from '../../priorities/priorities_structures';
import {$} from '../../caching/GlobalCache';
import {Task} from '../../tasks/Task';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {Roles, Setups} from '../../creepSetups/setups';

@profile
export class WorkerOverlord extends Overlord {

	workers: Zerg[];
	room: Room;
	repairStructures: Structure[];
	dismantleStructures: Structure[];
	fortifyStructures: (StructureWall | StructureRampart)[];
	constructionSites: ConstructionSite[];
	nukeDefenseRamparts: StructureRampart[];

	static settings = {
		barrierHits         : {			// What HP to fortify barriers to at each RCL
			1: 3e+3,
			2: 3e+3,
			3: 1e+4,
			4: 5e+4,
			5: 1e+5,
			6: 5e+5,
			7: 1e+6,
			8: 2e+7,
		},
		criticalHits        : 1000, 	// barriers below this health get priority treatment
		hitTolerance        : 100000, 	// allowable spread in HP
		fortifyDutyThreshold: 500000,	// ignore fortify duties until this amount of energy is present in the room
	};

	constructor(colony: Colony, priority = OverlordPriority.ownedRoom.work) {
		super(colony, 'worker', priority);
		this.workers = this.zerg(Roles.worker);
		// Fortification structures
		this.fortifyStructures = $.structures(this, 'fortifyStructures', () =>
			_.sortBy(_.filter(this.room.barriers, s =>
				s.hits < WorkerOverlord.settings.barrierHits[this.colony.level]
				&& this.colony.roomPlanner.barrierPlanner.barrierShouldBeHere(s.pos)
			), s => s.hits));
		// Generate a list of structures needing repairing (different from fortifying except in critical case)
		this.repairStructures = $.structures(this, 'repairStructures', () =>
			_.filter(this.colony.repairables, function (structure) {
				if (structure.structureType == STRUCTURE_CONTAINER) {
					return structure.hits < 0.5 * structure.hitsMax;
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
		if (this.room.find(FIND_NUKES).length > 0) {
			this.nukeDefenseRamparts = _.filter(this.colony.room.ramparts, function (rampart) {
				if (rampart.pos.lookFor(LOOK_NUKES).length > 0) {
					return rampart.hits < 10000000 + 10000;
				} else if (rampart.pos.findInRange(FIND_NUKES, 3).length > 0) {
					return rampart.hits < 5000000 + 10000;
				} else {
					return false;
				}
			});
		} else {
			this.nukeDefenseRamparts = [];
		}
	}

	refresh() {
		super.refresh();
		$.refresh(this, 'repairStructures', 'dismantleStructures', 'fortifyStructures', 'constructionSites',
				  'nukeDefenseRamparts');
	}

	init() {
		const setup = this.colony.level == 1 ? Setups.workers.early : Setups.workers.default;
		const workPartsPerWorker = setup.getBodyPotential(WORK, this.colony);
		let numWorkers: number;
		if (this.colony.stage == ColonyStage.Larva) {
			numWorkers = $.number(this, 'numWorkers', () => {
				// At lower levels, try to saturate the energy throughput of the colony
				const MAX_WORKERS = 10; // Maximum number of workers to spawn
				let energyPerTick = _.sum(_.map(this.colony.miningSites, site => site.overlords.mine.energyPerTick));
				let energyPerTickPerWorker = 1.1 * workPartsPerWorker; // Average energy per tick when workers are working
				let workerUptime = 0.8;
				let numWorkers = Math.ceil(energyPerTick / (energyPerTickPerWorker * workerUptime));
				return Math.min(numWorkers, MAX_WORKERS);
			});
		} else {
			if (this.colony.roomPlanner.memory.relocating) {
				// If relocating, maintain a maximum of workers
				numWorkers = 5;
			} else {
				numWorkers = $.number(this, 'numWorkers', () => {
					// At higher levels, spawn workers based on construction and repair that needs to be done
					const MAX_WORKERS = 3; // Maximum number of workers to spawn
					let constructionTicks = _.sum(this.constructionSites,
												  site => site.progressTotal - site.progress) / BUILD_POWER;
					let repairTicks = _.sum(this.repairStructures,
											structure => structure.hitsMax - structure.hits) / REPAIR_POWER;
					let paveTicks = _.sum(this.colony.rooms, room => this.colony.roadLogistics.energyToRepave(room));
					let fortifyTicks = 0;
					if (this.colony.assets.energy > WorkerOverlord.settings.fortifyDutyThreshold) {
						fortifyTicks = 0.25 * _.sum(this.fortifyStructures,
													barrier => WorkerOverlord.settings.barrierHits[this.colony.level]
															   - barrier.hits) / REPAIR_POWER;
					}
					// max constructionTicks for private server manually setting progress
					let numWorkers = Math.ceil(2 * (Math.max(constructionTicks, 0) + repairTicks + fortifyTicks) /
											   (workPartsPerWorker * CREEP_LIFE_TIME));
					return Math.min(numWorkers, MAX_WORKERS);
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

	private fortifyActions(worker: Zerg, fortifyStructures = this.fortifyStructures): boolean {
		let lowBarriers: (StructureWall | StructureRampart)[];
		let highestBarrierHits = _.max(_.map(fortifyStructures, structure => structure.hits));
		if (highestBarrierHits > WorkerOverlord.settings.hitTolerance) {
			// At high barrier HP, fortify only structures that are within a threshold of the lowest
			let lowestBarrierHits = _.min(_.map(fortifyStructures, structure => structure.hits));
			lowBarriers = _.filter(fortifyStructures, structure => structure.hits < lowestBarrierHits +
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
			if (this.colony.controller.ticksToDowngrade <= 1000) {
				if (this.upgradeActions(worker)) return;
			}
			// Repair damaged non-road non-barrier structures
			if (this.repairStructures.length > 0 && this.colony.defcon == DEFCON.safe) {
				if (this.repairActions(worker)) return;
			}
			// Build new structures
			if (this.constructionSites.length > 0) {
				if (this.buildActions(worker)) return;
			}
			// Build ramparts to block incoming nuke
			if (this.nukeDefenseRamparts.length > 0) {
				if (this.fortifyActions(worker, this.nukeDefenseRamparts)) return;
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
			if (this.fortifyStructures.length > 0) {
				if (this.fortifyActions(worker)) return;
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
