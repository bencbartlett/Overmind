// Road network: groups roads in a single object for more intelligent repair requests

import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';
import {Zerg} from '../Zerg';
import {repairTaskName} from '../tasks/instances/repair';


@profile
export class RoadLogistics {

	private colony: Colony;
	private rooms: Room[];
	private _assignedWorkers: { [roomName: string]: Zerg[] };
	private settings: {
		allowedPaversPerRoom: number,
		criticalThreshold: number,
		repairThreshold: number,
	};
	private cache: {
		repairableRoads: { [roomName: string]: StructureRoad[] };
		criticalRoads: { [roomName: string]: StructureRoad[] };
		energyToRepave: { [roomName: string]: number }
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.rooms = colony.rooms;
		this._assignedWorkers = {};
		this.settings = {
			allowedPaversPerRoom: 1,
			criticalThreshold   : 0.25, // When the roadnetwork forces a repair store
			repairThreshold     : 0.9
		};
		this.cache = {
			repairableRoads: {},
			criticalRoads  : {},
			energyToRepave : {}
		};
	}

	/* Whether a road in the network needs repair */
	private workerShouldRepaveRoom(worker: Zerg, room: Room): boolean {
		// Room should be repaved if there is a road with critical HP or if energy to repave >= worker carry capacity
		let otherAssignedWorkers = _.filter(this.assignedWorkers(room), zerg => zerg.name != worker.name);
		if (otherAssignedWorkers.length < this.settings.allowedPaversPerRoom) {
			if (this.assignedWorkers(room).includes(worker)) {
				// If worker is already working in the room, have it repair until all roads are at acceptable level
				return this.repairableRoads(room).length > 0;
			} else {
				// If worker is not already assigned, repair if critical roads or repaving energy >= carry capacity
				return this.criticalRoads(room).length > 0 || this.energyToRepave(room) >= worker.carryCapacity;
			}
		} else {
			return false;
		}
	}

	/* Get the room the worker should repave if any */
	workerShouldRepave(worker: Zerg): Room | undefined {
		// If the worker is already working in a room and should keep doing so, return that first
		for (let roomName in this._assignedWorkers) {
			let room = Game.rooms[roomName];
			if (this.assignedWorkers(room).includes(worker) && this.workerShouldRepaveRoom(worker, room)) {
				return room;
			}
		}
		// Otherwise scan through rooms and see if needs repaving
		for (let room of this.rooms) {
			if (this.workerShouldRepaveRoom(worker, room)) {
				return room;
			}
		}
	}

	criticalRoads(room: Room): StructureRoad[] {
		if (!this.cache.criticalRoads[room.name]) {
			this.cache.criticalRoads[room.name] = _.filter(room.roads, road =>
				road.hits < road.hitsMax * this.settings.criticalThreshold &&
				this.colony.roomPlanner.roadShouldBeHere(road.pos));
		}
		return this.cache.criticalRoads[room.name];
	}

	repairableRoads(room: Room): StructureRoad[] {
		if (!this.cache.repairableRoads[room.name]) {
			this.cache.repairableRoads[room.name] = _.filter(room.roads, road =>
				road.hits < road.hitsMax * this.settings.repairThreshold &&
				this.colony.roomPlanner.roadShouldBeHere(road.pos));
		}
		return this.cache.repairableRoads[room.name];
	}

	/* Total amount of energy needed to repair all roads in the room */
	energyToRepave(room: Room): number {
		if (!this.cache.energyToRepave[room.name]) {
			this.cache.energyToRepave[room.name] = _.sum(_.map(this.repairableRoads(room),
															   road => (road.hitsMax - road.hits) / REPAIR_POWER));
		}
		return this.cache.energyToRepave[room.name];
	}

	/* Check that the worker is in the assignedWorker cache; avoids bugs where duplicate workers get assigned
	 * on the same tick*/
	registerWorkerAssignment(worker: Zerg, room: Room): void {
		if (this._assignedWorkers[room.name]) {
			if (!this._assignedWorkers[room.name].includes(worker)) {
				this._assignedWorkers[room.name].push(worker);
			}
		} else {
			this._assignedWorkers[room.name] = [worker];
		}
	}

	assignedWorkers(room: Room): Zerg[] {
		if (this._assignedWorkers[room.name]) {
			return this._assignedWorkers[room.name];
		} else {
			return [];
		}
	}

	init(): void {
		let workers = this.colony.getCreepsByRole('worker');
		for (let worker of workers) {
			if (worker.task && worker.task.name == repairTaskName && worker.task.target) {
				let roomName = worker.task.target.pos.roomName;
				if (!this._assignedWorkers[roomName]) {
					this._assignedWorkers[roomName] = [];
				}
				this._assignedWorkers[roomName].push(worker);
			}
		}
	}

	run(): void {

	}

}

