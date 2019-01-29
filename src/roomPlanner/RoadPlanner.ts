/* Road planner: sensibly builds road networks around colonies */

import {Visualizer} from '../visuals/Visualizer';
import {RoomPlanner} from './RoomPlanner';
import {log} from '../console/log';
import {Mem} from '../memory/Memory';
import {Colony} from '../Colony';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';

export interface RoadPlannerMemory {
	roadLookup: { [roomName: string]: { [roadCoordName: string]: boolean } };
}

let memoryDefaults = {
	active    : true,
	roadLookup: {},
};

@profile
export class RoadPlanner {

	roomPlanner: RoomPlanner;
	colony: Colony;
	memory: RoadPlannerMemory;
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
		this.memory = Mem.wrap(this.colony.memory, 'roadPlanner', memoryDefaults);
		this.costMatrices = {};
		this.roadPositions = [];
	}

	refresh(): void {
		this.memory = Mem.wrap(this.colony.memory, 'roadPlanner', memoryDefaults);
		this.costMatrices = {};
		this.roadPositions = [];
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
		// Find the shortest path, preferentially stepping on tiles with road routing flags on them
		let roadPath = this.generateRoadPath(pos1, pos2, obstacles);
		if (roadPath) {
			this.roadPositions = this.roadPositions.concat(roadPath);
		}
	}

	private generateRoadPlanningCostMatrix(roomName: string, obstacles: RoomPosition[]): CostMatrix {

		let matrix = new PathFinder.CostMatrix();
		const terrain = Game.map.getRoomTerrain(roomName);

		const ROAD_PLANNER_WALL_COST = 50;

		for (let y = 0; y < 50; ++y) {
			for (let x = 0; x < 50; ++x) {
				switch (terrain.get(x, y)) {
					case TERRAIN_MASK_SWAMP:
						matrix.set(x, y, 1);
						break;
					case TERRAIN_MASK_WALL:
						matrix.set(x, y, ROAD_PLANNER_WALL_COST);
						break;
					default: // plain
						matrix.set(x, y, 1);
						break;
				}
			}
		}

		for (let pos of obstacles) {
			if (pos.roomName == roomName) {
				matrix.set(pos.x, pos.y, 0xff);
			}
		}

		const room = Game.rooms[roomName];
		if (room) {
			let impassibleStructures: Structure[] = [];
			_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
				if (!s.isWalkable) {
					impassibleStructures.push(s);
				}
			});
			_.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
			// Set passability of construction sites
			_.forEach(room.find(FIND_MY_CONSTRUCTION_SITES), (site: ConstructionSite) => {
				if (!site.isWalkable) {
					matrix.set(site.pos.x, site.pos.y, 0xff);
				}
			});
		}

		return matrix;
	}

	/* Generates a road path and modifies cost matrices to encourage merging with future roads */
	private generateRoadPath(origin: RoomPosition, destination: RoomPosition,
							 obstacles: RoomPosition[]): RoomPosition[] | undefined {

		let callback = (roomName: string): CostMatrix | boolean => {
			if (!this.colony.roomNames.includes(roomName)) { // only route through colony rooms
				return false;
			}
			if (Pathing.shouldAvoid(roomName) && roomName != origin.roomName && roomName != destination.roomName) {
				return false;
			}
			return this.generateRoadPlanningCostMatrix(roomName, obstacles);
		};

		let ret = PathFinder.search(origin, {pos: destination, range: 1}, {roomCallback: callback});

		if (ret.incomplete) {
			log.warning(`Roadplanner for ${this.colony.print}: could not plan road path!`);
			return;
		}

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
		if (_.keys(this.roomPlanner.map).length > 0) { // use active map
			roomPlannerRoads = this.roomPlanner.map[STRUCTURE_ROAD];
		} else { // retrieve from memory
			if (this.roomPlanner.memory.bunkerData && this.roomPlanner.memory.bunkerData.anchor) {
				let layout = this.roomPlanner.getStructureMapForBunkerAt(this.roomPlanner.memory.bunkerData.anchor);
				roomPlannerRoads = layout[STRUCTURE_ROAD];
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
				this.roomPlanner.shouldRecheck(3)) {
				this.buildMissing();
			}
		}
	}

	visuals(): void {
		// Draw the map
		Visualizer.drawRoads(this.roadPositions);
	}
}
