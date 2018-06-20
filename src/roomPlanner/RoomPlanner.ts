// The room planner allows you to plan the location of all structures in the room semi-automatically by placing
// components with flags. This code is a little messy, sorry.

import {hatcheryLayout} from './layouts/hatchery';
import {commandCenterLayout} from './layouts/commandCenter';
import {log} from '../console/log';
import {Visualizer} from '../visuals/Visualizer';
import {profile} from '../profiler/decorator';
import {Mem} from '../Memory';
import {Colony} from '../Colony';
import {RoadPlanner} from './RoadPlanner';
import {BarrierPlanner} from './BarrierPlanner';
import {BuildPriorities, DemolishStructurePriorities} from '../priorities/priorities_structures';
import {bunkerLayout} from './layouts/bunker';
import {DirectiveDismantle} from '../directives/targeting/dismantle';

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
	recheckStructuresAt?: number;
	bunkerData?: {
		anchor: protoPos,
	};
	lastGenerated?: number;
	mapsByLevel?: { [rcl: number]: { [structureType: string]: protoPos[] } };
	savedFlags: { secondaryColor: ColorConstant, pos: protoPos, memory: FlagMemory }[];
}

let memoryDefaults: PlannerMemory = {
	active    : true,
	savedFlags: [],
};

@profile
export class RoomPlanner {
	colony: Colony;							// The colony this is for
	map: StructureMap;						// Flattened {structureType: RoomPositions[]} for final structure placements
	placements: { 							// Used for generating the plan
		hatchery: RoomPosition | undefined;
		commandCenter: RoomPosition | undefined;
		bunker: RoomPosition | undefined;
	};
	plan: RoomPlan;							// Contains maps, positions, and rotations of each hivecluster component
	barrierPlanner: BarrierPlanner;
	roadPlanner: RoadPlanner;

	static settings = {
		recheckAfter      : 50,
		siteCheckFrequency: 250,
		maxSitesPerColony : 10,
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.placements = {
			hatchery     : undefined,
			commandCenter: undefined,
			bunker       : undefined,
		};
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

	/* Recall or reconstruct the appropriate map from memory */
	private recallMap(): void {
		if (this.memory.bunkerData && this.memory.bunkerData.anchor) {
			this.map = this.getStructureMapForBunkerAt(this.memory.bunkerData.anchor, this.colony.controller.level);
		} else if (this.memory.mapsByLevel) {
			this.map = _.mapValues(this.memory.mapsByLevel[this.colony.controller.level], posArr =>
				_.map(posArr, protoPos => derefRoomPosition(protoPos)));
		}
	}

	/* Return a list of room positions for planned structure locations at RCL8 (or undefined if plan isn't made yet) */
	plannedStructurePositions(structureType: StructureConstant): RoomPosition[] | undefined {
		if (this.map[structureType]) {
			return this.map[structureType];
		}
		if (this.memory.bunkerData && this.memory.bunkerData.anchor) {
			return this.getBunkerStructurePlacement(structureType, this.memory.bunkerData.anchor);
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

	get bunkerPos(): RoomPosition | undefined {
		if (this.placements.bunker) {
			return this.placements.bunker;
		}
		if (this.memory.bunkerData && this.memory.bunkerData.anchor) {
			return new RoomPosition(this.memory.bunkerData.anchor.x, this.memory.bunkerData.anchor.y, this.colony.name);
		}
	}

	private reactivate(): void {
		// Reinstantiate flags
		for (let protoFlag of this.memory.savedFlags) {
			let pos = derefRoomPosition(protoFlag.pos);
			let result = pos.createFlag(undefined, COLOR_WHITE, protoFlag.secondaryColor) as number | string;
			if (typeof result == 'string') {
				Memory.flags[result] = protoFlag.memory; // restore old memory
			}
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

	addComponent(componentName: 'hatchery' | 'commandCenter' | 'bunker', pos: RoomPosition, rotation = 0): void {
		this.placements[componentName] = pos;
	}

	/* Switcher that takes a component name and returns a layout */
	private getLayout(name: string): StructureLayout | undefined {
		switch (name) {
			case 'hatchery':
				return hatcheryLayout;
			case 'commandCenter':
				return commandCenterLayout;
			case 'bunker':
				return bunkerLayout;
		}
	}

	/* Generate a plan of component placements for a given RCL */
	private generatePlan(level = 8): RoomPlan {
		let plan: RoomPlan = {};
		for (let name in this.placements) {
			let layout = this.getLayout(name);
			if (layout) {
				let anchor: Coord = layout.data.anchor;
				let pos = this.placements[<'hatchery' | 'commandCenter' | 'bunker'>name];
				if (!pos) continue;
				let rotation: number = pos!.lookFor(LOOK_FLAGS)[0]!.memory.rotation || 0;
				let componentMap = this.parseLayout(layout, level);
				this.translateComponent(componentMap, anchor, pos!);
				if (rotation != 0) this.rotateComponent(componentMap, pos!, rotation);
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

	/* Get bunker building placements as a StructureMap */
	getStructureMapForBunkerAt(anchor: { x: number, y: number }, level = 8): StructureMap {
		let dx = anchor.x - bunkerLayout.data.anchor.x;
		let dy = anchor.y - bunkerLayout.data.anchor.y;
		let structureLayout = _.mapValues(bunkerLayout[level]!.buildings, obj => obj.pos) as { [s: string]: Coord[] };
		return _.mapValues(structureLayout, coordArr =>
			_.map(coordArr, coord => new RoomPosition(coord.x + dx, coord.y + dy, this.colony.name)));
	}

	/* Get the placement for a single type of structure for bunker layout */
	getBunkerStructurePlacement(structureType: string, anchor: { x: number, y: number },
								level = 8): RoomPosition[] {
		let dx = anchor.x - bunkerLayout.data.anchor.x;
		let dy = anchor.y - bunkerLayout.data.anchor.y;
		let structureLayout = _.mapValues(bunkerLayout[level]!.buildings, obj => obj.pos) as { [s: string]: Coord[] };
		return _.map(bunkerLayout[level]!.buildings[structureType].pos,
					 coord => new RoomPosition(coord.x + dx, coord.y + dy, this.colony.name));
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
			if (this.memory.bunkerData && this.memory.bunkerData.anchor) {
				let structureMap = this.getStructureMapForBunkerAt(this.memory.bunkerData.anchor);
				for (let structureType in structureMap) {
					if (!passableStructureTypes.includes(structureType)) {
						obstacles = obstacles.concat(structureMap[structureType]);
					}
				}
			} else if (this.memory.mapsByLevel) {
				for (let structureType in this.memory.mapsByLevel[8]) {
					if (!passableStructureTypes.includes(structureType)) {
						obstacles = obstacles.concat(_.map(this.memory.mapsByLevel[8][structureType],
														   protoPos => derefRoomPosition(protoPos)));
					}
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
			log.warning(`Invalid layout: collision detected at ${collision.print}!`);
			return;
		}
		let layoutIsValid: boolean = (!!this.placements.commandCenter && !!this.placements.hatchery)
									 || !!this.placements.bunker;
		if (layoutIsValid) { // Write everything to memory
			// Generate maps for each rcl
			delete this.memory.bunkerData;
			delete this.memory.mapsByLevel;
			if (this.placements.bunker) {
				this.memory.bunkerData = {
					anchor: this.placements.bunker,
				};
			} else {
				this.memory.mapsByLevel = {};
				for (let rcl = 1; rcl <= 8; rcl++) {
					this.make(rcl);
					this.memory.mapsByLevel[rcl] = this.map;
				}
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
												memory        : flag.memory,
											});
				flag.remove();
			}
			this.memory.lastGenerated = Game.time;
			console.log('Room layout and flag positions have been saved.');
			this.active = false;
			this.buildMissingStructures();
			// Finalize the road planner layout
		} else {
			log.warning('Not a valid room layout! Must have both hatchery and commandCenter placements ' +
						'or bunker placement.');
		}
	}

	init(): void {
		this.barrierPlanner.init();
		this.roadPlanner.init();
	}

	/* Whether a constructionSite should be placed at a position */
	static canBuild(structureType: BuildableStructureConstant, pos: RoomPosition): boolean {
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

	/* Whether a structure (or constructionSite) of given type should be at location. */
	structureShouldBeHere(structureType: BuildableStructureConstant, pos: RoomPosition): boolean {
		if (structureType == STRUCTURE_ROAD) {
			return this.roadShouldBeHere(pos);
		} else if (structureType == STRUCTURE_RAMPART) {
			return this.barrierPlanner.barrierShouldBeHere(pos);
		} else if (structureType == STRUCTURE_EXTRACTOR) {
			return pos.lookFor(LOOK_MINERALS).length > 0;
		} else {
			if (!this.map || this.map == {}) {
				this.recallMap();
			}
			let positions = this.map[structureType];
			if (positions) {
				let shouldBeHere = !!_.find(positions, p => p.isEqualTo(pos));
				if (!shouldBeHere && (structureType == STRUCTURE_CONTAINER || structureType == STRUCTURE_LINK)) {
					let thingsBuildingLinksAndContainers = _.compact([...this.colony.sources!,
																	  this.colony.room.mineral!,
																	  this.colony.controller!]);
					let maxRange = 4;
					return pos.findInRange(thingsBuildingLinksAndContainers, 4).length > 0;
				} else {
					return shouldBeHere;
				}
			}
		}
		return false;
	}

	/* Create construction sites for any buildings that need to be built */
	private demolishMisplacedStructures(): void {
		// Max buildings that can be placed each tick
		let count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;
		// Recall the appropriate map
		this.recallMap();
		if (!this.map || this.map == {}) { // in case a map hasn't been generated yet
			log.info(this.colony.name + ' does not have a room plan yet! Unable to demolish errant structures.');
		}
		// Build missing structures from room plan
		for (let priority of DemolishStructurePriorities) {
			let structureType = priority.structureType;
			let maxRemoved = priority.maxRemoved || Infinity;
			let shouldBreak = false;
			let removeCount = 0;
			let structures = _.filter(this.colony.room.find(FIND_STRUCTURES), s => s.structureType == structureType);
			let dismantleCount = _.filter(structures,
										  s => _.filter(s.pos.lookFor(LOOK_FLAGS),
														flag => DirectiveDismantle.filter(flag)).length > 0).length;
			for (let structure of structures) {
				if (!this.structureShouldBeHere(structureType, structure.pos)) {
					shouldBreak = true;
					let amountMissing = CONTROLLER_STRUCTURES[structureType][this.colony.level] - structures.length
										+ removeCount + dismantleCount;
					if (amountMissing < maxRemoved) {
						if (priority.dismantle) {
							DirectiveDismantle.createIfNotPresent(structure.pos, 'pos');
							dismantleCount++;
							this.memory.recheckStructuresAt = Game.time + RoomPlanner.settings.recheckAfter;
						} else {
							structure.destroy();
							removeCount++;
							this.memory.recheckStructuresAt = Game.time + RoomPlanner.settings.recheckAfter;
						}
					}
				}
			}
			if (shouldBreak) break;
		}
	}

	/* Create construction sites for any buildings that need to be built */
	private buildMissingStructures(): void {
		// Max buildings that can be placed each tick
		let count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;
		// Recall the appropriate map
		this.recallMap();
		if (!this.map || this.map == {}) { // in case a map hasn't been generated yet
			log.info(this.colony.name + ' does not have a room plan yet! Unable to build missing structures.');
		}
		// Build missing structures from room plan
		for (let structureType of BuildPriorities) {
			if (this.map[structureType]) {
				for (let pos of this.map[structureType]) {
					if (count > 0 && RoomPlanner.canBuild(structureType, pos)) {
						let result = pos.createConstructionSite(structureType);
						if (result != OK) {
							log.warning(`${this.colony.name}: couldn't create construction site of type ` +
										`"${structureType}" at ${pos.print}. Result: ${result}`);
						} else {
							count--;
							this.memory.recheckStructuresAt = Game.time + RoomPlanner.settings.recheckAfter;
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
			if (Game.time % RoomPlanner.settings.siteCheckFrequency == this.colony.id ||
				Game.time == (this.memory.recheckStructuresAt || Infinity)) {
				this.demolishMisplacedStructures();
			} else if (Game.time % RoomPlanner.settings.siteCheckFrequency == this.colony.id + 1 ||
					   Game.time == (this.memory.recheckStructuresAt || Infinity) + 1) {
				delete this.memory.recheckStructuresAt;
				this.buildMissingStructures();
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
