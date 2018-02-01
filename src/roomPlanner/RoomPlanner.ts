/* Layout: plans future buildings for rooms */
import {hatcheryLayout} from './layouts/hatchery';
import {commandCenterLayout} from './layouts/commandCenter';
import {log} from '../lib/logger/log';
import {Pathing} from '../pathing/pathing';
import {Visualizer} from '../visuals/Visualizer';
import {profile} from '../lib/Profiler';
import {Mem} from '../memcheck';
import {Colony} from '../Colony';
import {BuildPriorities} from '../config/priorities';

export interface BuildingPlannerOutput {
	name: string;
	shard: string;
	rcl: string;
	buildings: { [structureType: string]: { pos: Coord[] } };
}

export interface StructureLayout {
	[rcl: number]: BuildingPlannerOutput | undefined;

	data: {
		pos: Coord;
	}
}

export interface RoomPlan {
	[componentName: string]: {
		map: StructureMap;
		pos: RoomPosition;
		rotation: number;
	}
}

export interface PlannerMemory {
	active: boolean;
	mapsByLevel: { [rcl: number]: StructureMap };
	roadPositions: protoPos[];
	savedFlags: { secondaryColor: ColorConstant, pos: protoPos, memory: FlagMemory }[];
}

let memoryDefaults = {
	active       : true,
	mapsByLevel  : {},
	roadPositions: [],
	savedFlags   : [],
};

@profile
export class RoomPlanner {
	colony: Colony;							// The colony this is for
	map: StructureMap;						// Flattened {structureType: RoomPositions[]} for final structure placements
	placements: { [name: string]: RoomPosition }; // Used for generating the plan
	plan: RoomPlan;							// Contains maps, positions, and rotations of each hivecluster component
	// memory: PlannerMemory;					// Memory, stored on the room memory
	roadPositions: RoomPosition[];			// Roads that aren't part of components
	private settings: {
		siteCheckFrequency: number;
		maxSitesPerColony: number;
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.placements = {};
		this.plan = {};
		this.map = {};
		this.roadPositions = [];
		this.settings = {
			siteCheckFrequency: 200,
			maxSitesPerColony : 20,
		};
	}

	get memory(): PlannerMemory {
		return Mem.wrap(this.colony.memory, 'roomPlanner', memoryDefaults);
	}

	get active(): boolean {
		return this.memory.active;
	}

	set active(active: boolean) {
		this.memory.active = active;
		if (active) {
			this.reactivate();
		}
	}

	private reactivate(): void {
		// Reinstantiate flags
		for (let protoFlag of this.memory.savedFlags) {
			let pos = derefRoomPosition(protoFlag.pos);
			let result = pos.createFlag(undefined, COLOR_WHITE, protoFlag.secondaryColor);
			// if (typeof result == 'string') {
			// 	_.remove(this.memory.savedFlags, protoFlag);
			// }
			// TODO: add memory back on flag
		}
		this.memory.savedFlags = [];

		// Display the activation message
		let msg = [
			`Room planner activated for ${this.colony.name}. Reinstantiating flags from previous session on next tick.`,
			'Place colony components and routing hints with room planner flags:',
			'    Place hatchery:        white/green',
			'    Place command center:  white/blue',
			'    Place upgrade site:    white/purple',
			'    Place mining group:    white/yellow',
			'    Routing hints:         white/white',
			'Set component rotation by writing an angle (0,90,180,270 or 0,1,2,3) to flag.memory.rotation.',
			'Finalize layout '
		];
		_.forEach(msg, command => console.log(command));
	}

	/* Run the room planner to generate a plan and map*/
	private make(level = 8): void {
		// Reset everything
		this.plan = {};
		this.map = {};
		this.roadPositions = [];
		// Generate a plan, placing components by flags
		this.plan = this.generatePlan(level);
		// Flatten it into a map
		this.map = this.mapFromPlan(this.plan);
		// Connect commandCenter to hatchery, upgradeSites, and all miningSites, and place containers
		if (this.placements.commandCenter) {
			// Connect commandCenter to hatchery
			if (this.placements.hatchery) this.planRoad(this.placements.commandCenter, this.placements.hatchery);
			// Connect commandCenter to upgradeSite and place container site as necessary
			if (this.placements.upgradeSite) {
				this.planRoad(this.placements.commandCenter, this.placements.upgradeSite);
				this.placeStructure(STRUCTURE_CONTAINER, this.placements.upgradeSite);
			}
			// Connect commandCenter to each miningSite in the colony and place a container appropriately
			for (let i in this.colony.miningSites) {
				let site = this.colony.miningSites[i];
				let path = this.planRoad(this.placements.commandCenter, site.pos);
				if (path) { // replace the last element of the path with a container for the mining site
					let containerPos = _.last(path);
					_.remove(this.roadPositions, containerPos);
					this.placeStructure(STRUCTURE_CONTAINER, containerPos);
				}
			}
			_.forEach(this.colony.miningSites,
					  site => this.planRoad(this.placements.commandCenter, site.pos, {range: 2}));
		}
		this.formatRoadPositions();
	}

	/* Adds the specified structure directly to the map. Only callable after this.map is generated.
	 * Doesn't check for conflicts, so don't use freely. */
	private placeStructure(type: StructureConstant, pos: RoomPosition): void {
		if (!this.map[type]) this.map[type] = [];
		this.map[type].push(pos);
	}

	addComponent(componentName: string, pos: RoomPosition, rotation = 0): void {
		this.placements[componentName] = pos;
	}

	/* Switcher that takes a component name and returns a layout */
	private getLayout(name: string): StructureLayout | undefined {
		switch (name) {
			case 'hatchery':
				return hatcheryLayout;
			case 'commandCenter':
				return commandCenterLayout;
		}
	}

	/* Generate a plan of component placements for a given RCL */
	private generatePlan(level = 8): RoomPlan {
		let plan: RoomPlan = {};
		for (let name in this.placements) {
			let layout = this.getLayout(name);
			if (layout) {
				let anchor: Coord = layout.data.pos;
				let pos = this.placements[name];
				let rotation: number = pos.lookFor(LOOK_FLAGS)[0]!.memory.rotation || 0;
				let componentMap = this.parseLayout(layout, level);
				this.translateComponent(componentMap, anchor, pos);
				if (rotation != 0) this.rotateComponent(componentMap, pos, rotation);
				plan[name] = {
					map     : componentMap,
					pos     : new RoomPosition(anchor.x, anchor.y, this.colony.name),
					rotation: rotation,
				};
			}
		}
		return plan;
	}

	/* Generate a map of (structure type: RoomPositions[]) for a given layout */
	private parseLayout(structureLayout: StructureLayout, level = 8): StructureMap {
		let map = {} as StructureMap;
		let layout = structureLayout[level];
		if (layout) {
			for (let buildingName in layout.buildings) {
				map[buildingName] = _.map(layout.buildings[buildingName].pos,
										  pos => new RoomPosition(pos.x, pos.y, this.colony.name));
			}
		}
		return map;
	}

	/* Generate a flatened map from a plan */
	private mapFromPlan(plan: RoomPlan): StructureMap {
		let map: StructureMap = {};
		let componentMaps: StructureMap[] = _.map(plan, componentPlan => componentPlan.map);
		let structureNames: string[] = _.unique(_.flatten(_.map(componentMaps, map => _.keys(map))));
		for (let name of structureNames) {
			map[name] = _.compact(_.flatten(_.map(componentMaps, map => map[name])));
		}
		return map;
	}

	/* Aligns the component position to the desired position; operations done in-place */
	private translateComponent(map: StructureMap, fromPos: RoomPosition | Coord, toPos: RoomPosition | Coord): void {
		let dx = toPos.x - fromPos.x;
		let dy = toPos.y - fromPos.y;
		for (let structureType in map) {
			for (let pos of map[structureType]) {
				pos.x += dx;
				pos.y += dy;
			}
		}
	}

	/* Rotates component positions about a pivot point counterclockwise by the given angle; done in-place */
	private rotateComponent(map: StructureMap, pivot: RoomPosition | Coord, angle: number): void {
		let R = ([x, y]: number[]) => ([x, y]);
		if (angle == 0) {
			return;
		} else if (angle == 90 || angle == 1) {
			R = ([x, y]) => ([-y, x]);
		} else if (angle == 180 || angle == 2) {
			R = ([x, y]) => ([-x, -y]);
		} else if (angle == 270 || angle == 3) {
			R = ([x, y]) => ([y, -x]);
		}
		// Apply the rotation to the map
		let offset, dx, dy;
		for (let structureType in map) {
			for (let pos of map[structureType]) {
				offset = [pos.x - pivot.x, pos.y - pivot.y];
				[dx, dy] = R(offset);
				pos.x = pivot.x + dx;
				pos.y = pivot.y + dy;
			}
		}
	}

	// Plan a road between two locations; this.map must have been generated first!
	planRoad(pos1: RoomPosition, pos2: RoomPosition, opts: TravelToOptions = {}): RoomPosition[] | void {
		let obstacles: RoomPosition[] = [];
		for (let structureType in this.map) {
			if (structureType != STRUCTURE_ROAD) obstacles = obstacles.concat(this.map[structureType]);
		}
		obstacles = _.unique(obstacles);
		opts = _.merge(opts, {obstacles: obstacles});
		// Find the shortest path, preferentially stepping on tiles with road routing flags on them
		let roadPath = Pathing.routeRoadPath(pos1, pos2, opts);
		let shortestPath = Pathing.findShortestPath(pos1, pos2, opts).path;
		if (roadPath.length == shortestPath.length) {
			this.roadPositions = this.roadPositions.concat(roadPath);
			return roadPath;
		} else if (roadPath.length > shortestPath.length) {
			Visualizer.drawRoads(shortestPath);
			Visualizer.drawPath(roadPath, {stroke: 'red'});
			let textPos = roadPath[Math.floor(roadPath.length / 2 - 1)];
			Visualizer.text(`Road length: ${roadPath.length}; shortest length: ${shortestPath.length}`,
							textPos, {color: 'red'});
		} else {
			log.error(`${pos1} to ${pos2}: shortest path has length ${shortestPath.length}` +
					  `longer than road path length ${roadPath.length}... whaaaa?`);
		}
	}

	/* Ensure that the roads doesn't overlap with roads from this.map and that the positions are unique */
	private formatRoadPositions(): void {
		// Make road position list unique
		this.roadPositions = _.unique(this.roadPositions);
		// Remove roads located on exit tiles
		_.remove(this.roadPositions, pos => pos.isEdge);
		// Remove any roads duplicated in this.map
		_.remove(this.roadPositions, pos => this.map[STRUCTURE_ROAD] && this.map[STRUCTURE_ROAD].includes(pos));
	}

	/* Write everything to memory at the end of activation */
	finalize(): void {
		let layoutIsValid: boolean = !!this.placements.commandCenter &&
									 !!this.placements.hatchery &&
									 !!this.placements.upgradeSite;
		if (layoutIsValid) { // Write everything to memory
			// Generate maps for each rcl
			this.memory.mapsByLevel = {};
			for (let rcl = 1; rcl <= 8; rcl++) {
				this.make(rcl);
				this.memory.mapsByLevel[rcl] = this.map;
			}
			// Write road positions to memory, sorted by distance to storage
			this.memory.roadPositions = _.sortBy(this.roadPositions,
												 pos => pos.getMultiRoomRangeTo(this.placements.commandCenter));
			// Save flags and remove them
			let flagsToWrite = _.filter(this.colony.flags, flag => flag.color == COLOR_WHITE);
			for (let flag of flagsToWrite) {
				this.memory.savedFlags.push({
												secondaryColor: flag.secondaryColor,
												pos           : flag.pos,
												memory        : {} as FlagMemory
											});//flag.memory});
				flag.remove();
			}
			_.forEach(this.memory.savedFlags, i => console.log(i));
			console.log('Room layout and flag positions have been saved.');
			this.active = false;
		} else {
			console.log('Not a valid room layout! Must have hatchery, commandCenter and upgradeSite placements.');
		}
	}

	init(): void {

	}

	static shouldBuild(structureType: BuildableStructureConstant, pos: RoomPosition): boolean {
		if (!Game.rooms[pos.roomName]) return false;
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
		let count = this.settings.maxSitesPerColony - this.colony.constructionSites.length;
		// Recall the appropriate map
		this.map = this.memory.mapsByLevel[this.colony.controller.level];
		if (!this.map) { // in case a map hasn't been generated yet
			log.info(this.colony.name + ' does not have a room plan yet! Unable to build missing structures.');
		}
		// Build missing structures
		for (let structureType of BuildPriorities) {
			if (this.map[structureType]) {
				for (let protoPos of this.map[structureType]) {
					let pos = derefRoomPosition(protoPos);
					if (count > 0 && RoomPlanner.shouldBuild(structureType, pos)) {
						let ret = pos.createConstructionSite(structureType);
						if (ret != OK) {
							log.error(`${this.colony.name}: couldn't create construction site! ` +
									  `pos: ${pos.x} ${pos.y} ${pos.roomName}, type: ${structureType}, Result: ${ret}`);
						} else {
							count--;
						}
					}
				}
			}
		}
		// Build missing roads
		this.roadPositions = _.map(this.memory.roadPositions, protoPos => derefRoomPosition(protoPos));
		for (let pos of this.roadPositions) {
			if (count > 0 && RoomPlanner.shouldBuild(STRUCTURE_ROAD, pos)) {
				let ret = pos.createConstructionSite(STRUCTURE_ROAD);
				if (ret != OK) {
					log.error(`${this.colony.name}: couldn't create construction site! ` +
							  `pos: ${pos.x} ${pos.y} ${pos.roomName}, type: ${STRUCTURE_ROAD}, Result: ${ret}`);
				} else {
					count--;
				}
			}
		}
	}

	run(): void {
		if (this.active) {
			this.make();
			this.visuals();
		} else {
			if (Game.time % this.settings.siteCheckFrequency == 0) {
				this.buildMissing();
			}
		}
	}

	visuals(): void {
		// Draw the map
		Visualizer.drawLayout(this.map, this.colony.name);
		Visualizer.drawRoads(this.roadPositions);
	}

}
