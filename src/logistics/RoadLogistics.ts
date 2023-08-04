import {$} from '../caching/GlobalCache';
import {Colony} from '../Colony';
import {profile} from '../profiler/decorator';
import {repairTaskName} from '../tasks/instances/repair';
import {Task} from '../tasks/Task';
import {Tasks} from '../tasks/Tasks';
import {Zerg} from '../zerg/Zerg';

const ROAD_CACHE_TIMEOUT = 25;


/**
 * RoadLogistics: groups roads in a single object for more intelligent repair requests
 */
@profile
export class RoadLogistics {

	ref: string;
	private colony: Colony;
	private _assignedWorkers: { [roomName: string]: string[] };

	static settings = {
		allowedPaversPerRoom: 1,
		criticalThreshold   : 0.25, // When the roadnetwork forces a repair store
		repairThreshold     : 0.9
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.ref = this.colony.name + ':roadLogistics';
		this._assignedWorkers = {};
	}

	refresh() {
		this._assignedWorkers = {};
	}

	/**
	 * Whether a road in the network needs repair
	 */
	private workerShouldRepaveRoom(worker: Zerg, room: Room): boolean {
		// Room should be repaved if there is a road with critical HP or if energy to repave >= worker carry capacity
		const otherAssignedWorkers = _.filter(this.assignedWorkers(room), name => name != worker.name);
		if (otherAssignedWorkers.length < RoadLogistics.settings.allowedPaversPerRoom) {
			if (this.assignedWorkers(room).includes(worker.name)) {
				// If worker is already working in the room, have it repair until all roads are at acceptable level
				return this.repairableRoads(room).length > 0;
			} else {
				// If worker is not already assigned, repair if critical roads or repaving energy >= carry capacity
				return this.criticalRoads(room).length > 0 || this.energyToRepave(room.name) >= worker.carryCapacity;
			}
		} else {
			return false;
		}
	}

	/**
	 * Get the room the worker should repave, if any
	 */
	workerShouldRepave(worker: Zerg): Room | undefined {
		// If the worker is already working in a room and should keep doing so, return that first
		if (worker.task && worker.task.name == repairTaskName) {
			const room = Game.rooms[worker.task.targetPos.roomName];
			if (room && this.assignedWorkers(room).includes(worker.name)
				&& this.workerShouldRepaveRoom(worker, room)) {
				return room;
			}
		}
		// Otherwise scan through rooms and see if needs repaving
		for (const room of this.colony.rooms) {
			if (this.colony.isRoomActive(room.name) && room.isSafe && this.workerShouldRepaveRoom(worker, room)) {
				return room;
			}
		}
	}

	criticalRoads(room: Room): StructureRoad[] {
		return $.structures(this, 'criticalRoads:' + room.name, () => {
			const criticalRoads = _.filter(room.roads,
										   road => road.hits < road.hitsMax * RoadLogistics.settings.criticalThreshold
												   && this.colony.roomPlanner.roadShouldBeHere(road.pos));
			return _.sortBy(criticalRoads, road => road.pos.getMultiRoomRangeTo(this.colony.pos));
		}, ROAD_CACHE_TIMEOUT);
	}

	repairableRoads(room: Room): StructureRoad[] {
		return $.structures(this, 'repairableRoads:' + room.name, () => {
			const repairRoads = _.filter(room.roads,
										 road => road.hits < road.hitsMax * RoadLogistics.settings.repairThreshold
												 && this.colony.roomPlanner.roadShouldBeHere(road.pos));
			return _.sortBy(repairRoads, road => road.pos.getMultiRoomRangeTo(this.colony.pos));
		}, ROAD_CACHE_TIMEOUT);
	}

	unbuiltRoads(room: Room): RoomPosition[] {
		return $.list(this, 'repairableRoads:' + room.name, () => {
			const roadPositions = this.colony.roomPlanner.roadPlanner.getRoadPositions(room.name);
			const unbuiltPositions = _.filter(roadPositions, pos => !pos.lookForStructure(STRUCTURE_ROAD));
			return _.sortBy(unbuiltPositions, pos => pos.getMultiRoomRangeTo(this.colony.pos));
		}, ROAD_CACHE_TIMEOUT);
	}

	/**
	 * Total amount of energy needed to repair all roads in the room and build all needed roads
	 */
	energyToRepave(roomName: string): number {
		const room = Game.rooms[roomName] as Room | undefined;
		if (room) {
			return $.number(this, 'energyToRepave:' + room.name, () => {
				const repairEnergy = _.sum(this.repairableRoads(room), road => (road.hitsMax - road.hits))
									 / REPAIR_POWER;
				const terrain = room.getTerrain();
				const buildEnergy = _.sum(this.unbuiltRoads(room), pos => {
					if (terrain.get(pos.x, pos.y) == TERRAIN_MASK_SWAMP) {
						return CONSTRUCTION_COST.road * CONSTRUCTION_COST_ROAD_SWAMP_RATIO;
					} else if (terrain.get(pos.x, pos.y) == TERRAIN_MASK_WALL) {
						return CONSTRUCTION_COST.road * CONSTRUCTION_COST_ROAD_WALL_RATIO;
					} else {
						return CONSTRUCTION_COST.road;
					}
				}) / BUILD_POWER;
				return repairEnergy + buildEnergy;
			}, ROAD_CACHE_TIMEOUT);
		} else {
			const cached = $.numberRecall(this, 'energyToRepave:' + roomName);
			if (cached) {
				return cached;
			} else {
				return 0;
			}
		}

	}

	/**
	 * Check that the worker is in the assignedWorker cache; avoids bugs where duplicate workers get assigned
	 * on the same tick
	 */
	registerWorkerAssignment(worker: Zerg, room: Room): void {
		if (this._assignedWorkers[room.name]) {
			if (!this._assignedWorkers[room.name].includes(worker.name)) {
				this._assignedWorkers[room.name].push(worker.name);
			}
		} else {
			this._assignedWorkers[room.name] = [worker.name];
		}
	}

	assignedWorkers(room: Room): string[] {
		return this._assignedWorkers[room.name] || [];
	}

	init(): void {
		const workers = this.colony.overlords.work.workers;
		for (const worker of workers) {
			if (worker.task && worker.task.name == repairTaskName) {
				const roomName = worker.task.targetPos.roomName;
				if (!this._assignedWorkers[roomName]) {
					this._assignedWorkers[roomName] = [];
				}
				this._assignedWorkers[roomName].push(worker.name);
			}
		}
	}

	buildPavingManifest(worker: Zerg, room: Room): Task<any> | null {
		let energy = worker.carry.energy;
		const targetRefs: { [ref: string]: boolean } = {};
		const tasks: Task<any>[] = [];
		let target: StructureRoad | undefined;
		let previousPos: RoomPosition | undefined;
		while (true) {
			if (energy <= 0) break;
			if (previousPos) {
				target = _.find(this.repairableRoads(room),
								road => road.hits < road.hitsMax && !targetRefs[road.id]
										&& road.pos.getRangeTo(previousPos!) <= 1);
			} else {
				target = _.find(this.repairableRoads(room),
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

	run(): void {

	}

}

