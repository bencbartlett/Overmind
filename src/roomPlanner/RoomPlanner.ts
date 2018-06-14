/* Layout: plans future buildings for rooms */
import {hatcheryLayout} from './layouts/hatchery';
import {commandCenterLayout} from './layouts/commandCenter';
import {log} from '../lib/logger/log';
import {Visualizer} from '../visuals/Visualizer';
import {profile} from '../profiler/decorator';
import {Mem} from '../Memory';
import {Colony} from '../Colony';
import {RoadPlanner} from './RoadPlanner';
import {BarrierPlanner} from './BarrierPlanner';
import {BuildPriorities} from '../priorities/priorities_structures';

export interface BuildingPlannerOutput {
	name: string;
	shard: string;
	rcl: string;
	buildings: { [structureType: string]: { pos: Coord[] } };
}

export interface StructureLayout {
	[rcl: number]: BuildingPlannerOutput | undefined;

	data: {
		anchor: Coord;
		pointsOfInterest?: {
			[pointLabel: string]: Coord;
		}
	}
}

export interface StructureMap {
	[structureType: string]: RoomPosition[];
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
	lastGenerated?: number;
	mapsByLevel: { [rcl: number]: { [structureType: string]: protoPos[] } };
	savedFlags: { secondaryColor: ColorConstant, pos: protoPos, memory: FlagMemory }[];
}

let memoryDefaults = {
	active     : true,
	mapsByLevel: {},
	savedFlags : [],
};

@profile
export class RoomPlanner {
	colony: Colony;							// The colony this is for
	map: StructureMap;						// Flattened {structureType: RoomPositions[]} for final structure placements
	placements: { 							// Used for generating the plan
		[name: string]: RoomPosition
	};
	plan: RoomPlan;							// Contains maps, positions, and rotations of each hivecluster component
	barrierPlanner: BarrierPlanner;
	roadPlanner: RoadPlanner;

	static settings = {
		siteCheckFrequency: 200,
		maxSitesPerColony : 10,
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.placements = {};
		this.plan = {};
		this.map = {};
		this.barrierPlanner = new BarrierPlanner(this);
		this.roadPlanner = new RoadPlanner(this);
		if (this.active && Game.time % 25 == 0) {
			log.alert(`RoomPlanner for ${this.colony.room.print} is still active! Close to save CPU.`);
		}
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

	/* Return a list of room positions for planned structure locations at RCL8 (or undefined if plan isn't made yet) */
	plannedStructurePositions(structureType: StructureConstant): RoomPosition[] | undefined {
		if (this.map[structureType]) {
			return this.map[structureType];
		}
		let roomMap = this.memory.mapsByLevel ? this.memory.mapsByLevel[8] : undefined;
		if (roomMap && roomMap[structureType]) {
			return _.map(roomMap[structureType], protoPos => derefRoomPosition(protoPos));
		}
	}

	/* Return the planned location of the storage structure */
	get storagePos(): RoomPosition | undefined {
		if (this.placements.commandCenter) {
			return this.placements.commandCenter;
		}
		let positions = this.plannedStructurePositions(STRUCTURE_STORAGE);
		if (positions) {
			return positions[0];
		}
	}

	/* Return the planned location of the storage structure */
	get hatcheryPos(): RoomPosition | undefined {
		if (this.placements.hatchery) {
			return this.placements.hatchery;
		}
		let positions = this.plannedStructurePositions(STRUCTURE_SPAWN);
		if (positions) {
			return positions[0];
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
			'Place colony components with room planner flags:',
			'    Place hatchery:        white/green',
			'    Place command center:  white/blue',
			// 'Set component rotation by writing an angle (0,90,180,270 or 0,1,2,3) to flag.memory.rotation.',
			'Finalize layout '
		];
		_.forEach(msg, command => console.log(command));
	}

	/* Run the room planner to generate a plan and map*/
	private make(level = 8): void {
		// Reset everything
		this.plan = {};
		this.map = {};
		// Generate a plan, placing components by flags
		this.plan = this.generatePlan(level);
		// Flatten it into a map
		this.map = this.mapFromPlan(this.plan);
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
				let anchor: Coord = layout.data.anchor;
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

	// TODO: component rotation isn't currently fully supported
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


	/* Generates a list of impassible obstacles from this.map or from this.memory.map */
	getObstacles(): RoomPosition[] {
		let obstacles: RoomPosition[] = [];
		let passableStructureTypes: string[] = [STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART];
		if (this.map != {}) { // if room planner has made the map, use that
			for (let structureType in this.map) {
				if (!passableStructureTypes.includes(structureType)) {
					obstacles = obstacles.concat(this.map[structureType]);
				}
			}
		} else { // else, serialize from memory
			for (let structureType in this.memory.mapsByLevel[8]) {
				if (!passableStructureTypes.includes(structureType)) {
					obstacles = obstacles.concat(_.map(this.memory.mapsByLevel[8][structureType],
													   protoPos => derefRoomPosition(protoPos)));
				}
			}
		}
		return _.unique(obstacles);
	}

	/* Check to see if there are any structures that can't be built */
	private findCollision(ignoreRoads = false): RoomPosition | undefined {
		for (let structureType in this.map) {
			if (ignoreRoads && structureType == STRUCTURE_ROAD) {
				continue;
			}
			for (let pos of this.map[structureType]) {
				if (Game.map.getTerrainAt(pos) == 'wall') {
					return pos;
				}
			}
		}
	}

	/* Write everything to memory at the end of activation. If ignoreRoads is set, it will allow collisions with
	 * roads, but will continue to alert you every time it fails to build a road in the terrain pos (WIP) */
	finalize(ignoreRoads = false): void {
		let collision = this.findCollision(ignoreRoads);
		if (collision) {
			console.log(`Invalid layout: collision detected at ${collision.print}!`);
			return;
		}
		let layoutIsValid: boolean = !!this.placements.commandCenter && !!this.placements.hatchery;
		if (layoutIsValid) { // Write everything to memory
			// Generate maps for each rcl
			this.memory.mapsByLevel = {};
			for (let rcl = 1; rcl <= 8; rcl++) {
				this.make(rcl);
				this.memory.mapsByLevel[rcl] = this.map;
			}
			// Finalize the barrier planner
			this.barrierPlanner.finalize();
			// Finalize the road planner
			this.roadPlanner.finalize();
			// Save flags and remove them
			let flagsToWrite = _.filter(this.colony.flags, flag => flag.color == COLOR_WHITE);
			for (let flag of flagsToWrite) {
				this.memory.savedFlags.push({
												secondaryColor: flag.secondaryColor,
												pos           : flag.pos,
												memory        : {} as FlagMemory
											});
				flag.remove();
			}
			this.memory.lastGenerated = Game.time;
			console.log('Room layout and flag positions have been saved.');
			this.active = false;
			this.buildMissing();
			// Finalize the road planner layout
		} else {
			console.log('Not a valid room layout! Must have hatchery and commandCenter placements.');
		}
	}

	init(): void {
		this.barrierPlanner.init();
		this.roadPlanner.init();
	}

	/* Whether a constructionSite should be placed at a position */
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
		// Recall the appropriate map
		this.map = _.mapValues(this.memory.mapsByLevel[this.colony.controller.level], posArr =>
			_.map(posArr, protoPos => derefRoomPosition(protoPos)));
		if (!this.map) { // in case a map hasn't been generated yet
			log.info(this.colony.name + ' does not have a room plan yet! Unable to build missing structures.');
		}
		// Build missing structures from room plan
		for (let structureType of BuildPriorities) {
			if (this.map[structureType]) {
				for (let pos of this.map[structureType]) {
					if (count > 0 && RoomPlanner.shouldBuild(structureType, pos)) {
						let ret = pos.createConstructionSite(structureType);
						if (ret != OK) {
							log.error(`${this.colony.name}: couldn't create construction site of type ` +
									  `"${structureType}" at ${pos.print}. Result: ${ret}`);
						} else {
							count--;
						}
					}
				}
			}
		}
		// Build extractor on mineral deposit if not already present
		let mineral = this.colony.room.find(FIND_MINERALS)[0];
		if (mineral) {
			let extractor = mineral.pos.lookForStructure(STRUCTURE_EXTRACTOR);
			if (!extractor) {
				mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR);
			}
		}
	}

	/* Quick lookup for if a road should be in this position. Roads returning false won't be maintained. */
	roadShouldBeHere(pos: RoomPosition): boolean {
		return this.roadPlanner.roadShouldBeHere(pos);
	}

	run(): void {
		if (this.active) {
			this.make();
			this.visuals();
		} else {
			if (Game.time % RoomPlanner.settings.siteCheckFrequency == this.colony.id) {
				this.buildMissing();
			}
		}
		// Run the barrier planner
		this.barrierPlanner.run();
		// Run the road planner
		this.roadPlanner.run();
	}

	visuals(): void {
		// Draw the map
		Visualizer.drawLayout(this.map);
	}

}
