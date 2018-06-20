/* Road planner: sensibly builds road networks around colonies */

import {Visualizer} from '../visuals/Visualizer';
import {RoomPlanner} from './RoomPlanner';
import {log} from '../console/log';
import {Mem} from '../Memory';
import {Colony} from '../Colony';
import {Pathing} from '../movement/Pathing';

export interface RoadPlannerMemory {
	roadLookup: { [roomName: string]: { [roadCoordName: string]: boolean } };
}

let memoryDefaults = {
	active    : true,
	roadLookup: {},
};

export class RoadPlanner {

	roomPlanner: RoomPlanner;
	colony: Colony;
	roadPositions: RoomPosition[];
	costMatrices: { [roomName: string]: CostMatrix };

	static settings = {
		encourageRoadMerging          : true,		// will reduce cost of some tiles in existing paths to encourage merging
		tileCostReductionInterval     : 10,			// spatial frequency of tile cost reduction
		recalculateRoadNetworkInterval: 1000, 		// recalculate road networks every (this many) ticks
		buildRoadsAtRCL               : 4,
	};

	constructor(roomPlanner: RoomPlanner) {
		this.roomPlanner = roomPlanner;
		this.colony = roomPlanner.colony;
		this.costMatrices = {};
		this.roadPositions = [];
	}

	get memory(): RoadPlannerMemory {
		return Mem.wrap(this.colony.memory, 'roadPlanner', memoryDefaults);
	}

	private recalculateRoadNetwork(storagePos: RoomPosition, obstacles: RoomPosition[]): void {
		this.buildRoadNetwork(storagePos, obstacles);
		this.finalize();
	}

	// Connect commandCenter to hatchery, upgradeSites, and all miningSites, and place containers
	private buildRoadNetwork(storagePos: RoomPosition, obstacles: RoomPosition[]): void {
		this.costMatrices = {};
		this.roadPositions = [];
		let destinations = _.sortBy(this.colony.destinations, pos => pos.getMultiRoomRangeTo(storagePos));
		// Connect commandCenter to each destination in colony
		for (let pos of destinations) {
			this.planRoad(storagePos, pos, obstacles);
		}
		this.formatRoadPositions();
	}

	// Plan a road between two locations avoiding a list of planned obstacles; pos1 should be storage for best results
	private planRoad(pos1: RoomPosition, pos2: RoomPosition, obstacles: RoomPosition[]): void {
		let opts = {obstacles: obstacles, ensurePath: true, range: 1};
		// Find the shortest path, preferentially stepping on tiles with road routing flags on them
		let roadPath = this.generateRoadPath(pos1, pos2, opts);
		if (roadPath) {
			this.roadPositions = this.roadPositions.concat(roadPath);
		}
	}

	private initCostMatrix(roomName: string, options: MoveOptions) {
		let room = Game.rooms[roomName];
		if (room) {
			this.costMatrices[roomName] = Pathing.getCostMatrix(room, options);
		} else {
			this.costMatrices[roomName] = new PathFinder.CostMatrix();
		}
	}

	/* Generates a road path and modifies cost matrices to encourage merging with future roads */
	private generateRoadPath(origin: RoomPosition, destination: RoomPosition,
							 options: MoveOptions = {}): RoomPosition[] | undefined {
		_.defaults(options, {
			ignoreCreeps: true,
			ensurePath  : true,
			range       : 1,
			offRoad     : true,
			avoidSK     : false,
		});

		let allowedRooms = Pathing.findRoute(origin.roomName, destination.roomName, options);
		let callback = (roomName: string): CostMatrix | boolean => {
			if (allowedRooms && !allowedRooms[roomName]) {
				return false;
			}
			if (!options.allowHostile && Pathing.shouldAvoid(roomName)
				&& roomName != origin.roomName && roomName != destination.roomName) {
				return false;
			}
			// Initialize cost matrix
			if (!this.costMatrices[roomName]) {
				this.initCostMatrix(roomName, options);
			}
			return this.costMatrices[roomName];
		};

		let ret = PathFinder.search(origin, {pos: destination, range: options.range!}, {
			maxOps      : options.maxOps,
			maxRooms    : options.maxRooms,
			plainCost   : 2,
			swampCost   : 2,
			roomCallback: callback,
		});

		if (ret.incomplete) return;

		// Set every n-th tile of a planned path to be cost 1 to encourage road overlap for future pathing
		if (RoadPlanner.settings.encourageRoadMerging) {
			let interval = RoadPlanner.settings.tileCostReductionInterval;
			for (let i of _.range(ret.path.length)) {
				if (i % interval == interval - 1) {
					let pos = ret.path[i];
					if (this.costMatrices[pos.roomName] && !pos.isEdge) {
						this.costMatrices[pos.roomName].set(pos.x, pos.y, 0x01);
					}
				}
			}
		}
		// Return the pathfinder results
		return ret.path;
	}

	/* Ensure that the roads doesn't overlap with roads from this.map and that the positions are unique */
	private formatRoadPositions(): void {
		// Make road position list unique
		this.roadPositions = _.unique(this.roadPositions);
		// Remove roads located on exit tiles
		_.remove(this.roadPositions, pos => pos.isEdge);
		// Remove any roads duplicated in this.map
		let roomPlannerRoads = this.roomPlanner.plannedStructurePositions(STRUCTURE_ROAD);
		if (roomPlannerRoads != undefined) {
			_.remove(this.roadPositions, pos => roomPlannerRoads!.includes(pos));
		}
	}

	/* Write everything to memory after roomPlanner is closed */
	finalize(): void {
		// Collect all roads from this and from room planner
		let roomPlannerRoads: RoomPosition[];
		if (this.roomPlanner.map != {}) { // use active map
			roomPlannerRoads = this.roomPlanner.map[STRUCTURE_ROAD];
		} else { // retrieve from memory
			if (this.roomPlanner.memory.bunkerData && this.roomPlanner.memory.bunkerData.anchor) {
				let layout = this.roomPlanner.getStructureMapForBunkerAt(this.roomPlanner.memory.bunkerData.anchor);
				roomPlannerRoads = layout[STRUCTURE_ROAD] || [];
			} else if (this.roomPlanner.memory.mapsByLevel) {
				roomPlannerRoads = _.map(this.roomPlanner.memory.mapsByLevel[8][STRUCTURE_ROAD],
										 protoPos => derefRoomPosition(protoPos));
			} else {
				log.error(`RoadPlanner@${this.colony.room.print}: could not get road positions from room planner!`);
				roomPlannerRoads = [];
			}
		}
		let allRoadPos: RoomPosition[] = _.compact(this.roadPositions.concat(roomPlannerRoads));
		// Encode the coordinates of the road as keys in a truthy hash table for fast lookup
		this.memory.roadLookup = {};
		for (let pos of allRoadPos) {
			if (!this.memory.roadLookup[pos.roomName]) this.memory.roadLookup[pos.roomName] = {};
			this.memory.roadLookup[pos.roomName][pos.coordName] = true;
		}
	}

	init(): void {

	}

	static shouldBuild(structureType: BuildableStructureConstant, pos: RoomPosition): boolean {
		if (!pos.room) return false;
		let buildings = _.filter(pos.lookFor(LOOK_STRUCTURES), s => s && s.structureType == structureType);
		let sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
		if (!buildings || buildings.length == 0) {
			if (!sites || sites.length == 0) {
				return true;
			}
		}
		return false;
	}

	/* Create construction sites for any buildings that need to be built */
	private buildMissing(): void {
		// Max buildings that can be placed each tick
		let count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;
		// Build missing roads
		let roadPositions = [];
		for (let roomName in this.memory.roadLookup) {
			for (let coords of _.keys(this.memory.roadLookup[roomName])) {
				let [x, y] = coords.split(':');
				roadPositions.push(new RoomPosition(parseInt(x, 10), parseInt(y, 10), roomName));
			}
		}
		let origin = (this.colony.storage || this.colony.hatchery || this.colony).pos;
		roadPositions = _.sortBy(roadPositions, pos => pos.getMultiRoomRangeTo(origin));
		for (let pos of roadPositions) {
			if (count > 0 && RoomPlanner.canBuild(STRUCTURE_ROAD, pos)) {
				let ret = pos.createConstructionSite(STRUCTURE_ROAD);
				if (ret != OK) {
					log.warning(`${this.colony.name}: couldn't create road site at ${pos.print}. Result: ${ret}`);
				} else {
					count--;
				}
			}
		}
	}

	/* Quick lookup for if a road should be in this position. Roads returning false won't be maintained. */
	roadShouldBeHere(pos: RoomPosition): boolean {
		// Initial migration code, can delete later
		if (this.memory.roadLookup[pos.roomName]) {
			return this.memory.roadLookup[pos.roomName][pos.coordName];
		}
		return false;
	}

	run(): void {
		if (this.roomPlanner.active) {
			if (this.roomPlanner.storagePos) {
				this.buildRoadNetwork(this.roomPlanner.storagePos, this.roomPlanner.getObstacles());
			}
			this.visuals();
		} else {
			// Once in a blue moon, recalculate the entire network and write to memory to keep it up to date
			if (Game.time % RoadPlanner.settings.recalculateRoadNetworkInterval == this.colony.id) {
				if (this.roomPlanner.storagePos) {
					this.recalculateRoadNetwork(this.roomPlanner.storagePos, this.roomPlanner.getObstacles());
				}
			}
			if (this.colony.level >= RoadPlanner.settings.buildRoadsAtRCL &&
				Game.time % RoomPlanner.settings.siteCheckFrequency == this.colony.id + 2) {
				this.buildMissing();
			}
		}
	}

	visuals(): void {
		// Draw the map
		Visualizer.drawRoads(this.roadPositions);
	}
}
