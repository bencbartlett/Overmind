import {Colony, getAllColonies} from '../Colony';
import {log} from '../console/log';
import {isOwnedStructure} from '../declarations/typeGuards';
import {DirectiveTerminalRebuildState} from '../directives/terminalState/terminalState_rebuild';
import {Energetics} from '../logistics/Energetics';
import {Autonomy, getAutonomyLevel, Mem} from '../memory/Memory';
import {Pathing} from '../movement/Pathing';
import {BuildPriorities, DemolishStructurePriorities} from '../priorities/priorities_structures';
import {profile} from '../profiler/decorator';
import {bullet} from '../utilities/stringConstants';
import {derefCoords, maxBy, onPublicServer} from '../utilities/utils';
import {Visualizer} from '../visuals/Visualizer';
import {MY_USERNAME} from '../~settings';
import {BarrierPlanner} from './BarrierPlanner';
import {bunkerLayout} from './layouts/bunker';
import {commandCenterLayout} from './layouts/commandCenter';
import {hatcheryLayout} from './layouts/hatchery';
import {RoadPlanner} from './RoadPlanner';

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
	};
}

export interface StructureMap {
	[structureType: string]: RoomPosition[];
}

export interface RoomPlan {
	[componentName: string]: {
		map: StructureMap;
		pos: RoomPosition;
		rotation: number;
	};
}

export interface PlannerMemory {
	active: boolean;
	relocating?: boolean;
	recheckStructuresAt?: number;
	bunkerData?: {
		anchor: ProtoPos,
	};
	lastGenerated?: number;
	mapsByLevel?: { [rcl: number]: { [structureType: string]: ProtoPos[] } };
	savedFlags: { secondaryColor: ColorConstant, pos: ProtoPos, memory: FlagMemory }[];
}

const memoryDefaults: PlannerMemory = {
	active    : true,
	savedFlags: [],
};


export function getAllStructureCoordsFromLayout(layout: StructureLayout, rcl: number): Coord[] {
	if (!layout[rcl]) {
		return [];
	}
	const positionsByType = layout[rcl]!.buildings;
	let coords: Coord[] = [];
	for (const structureType in positionsByType) {
		coords = coords.concat(positionsByType[structureType].pos);
	}
	return _.unique(coords, coord => coord.x + 50 * coord.y);
}

export function translatePositions(positions: RoomPosition[], fromAnchor: Coord, toAnchor: Coord) {
	const dx = toAnchor.x - fromAnchor.x;
	const dy = toAnchor.y - fromAnchor.y;
	const newPositions = [];
	for (const pos of positions) {
		newPositions.push(new RoomPosition(pos.x + dx, pos.y + dy, pos.roomName));
	}
	return newPositions;
}

/**
 * The room planner handles structure placement within a room automatically or (in manual or semiautomatic mode) with
 * manual guidance from room planner flags.
 */
@profile
export class RoomPlanner {
	colony: Colony;							// The colony this is for
	memory: PlannerMemory;
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
		siteCheckFrequency: onPublicServer() ? 300 : 100,	// how often to recheck for structures; doubled at RCL8
		linkCheckFrequency: 100,
		maxSitesPerColony : onPublicServer() ? 10 : 25,
		maxDismantleCount : 5,
	};

	constructor(colony: Colony) {
		this.colony = colony;
		this.memory = Mem.wrap(this.colony.memory, 'roomPlanner', memoryDefaults);
		this.barrierPlanner = new BarrierPlanner(this);
		this.roadPlanner = new RoadPlanner(this);
		this.refresh();
	}

	refresh(): void {
		this.memory = Mem.wrap(this.colony.memory, 'roomPlanner', memoryDefaults);
		this.placements = {
			hatchery     : undefined,
			commandCenter: undefined,
			bunker       : undefined,
		};
		this.plan = {};
		this.map = {};
		this.barrierPlanner.refresh();
		this.roadPlanner.refresh();
		if (this.active && Game.time % 25 == 0) {
			log.alert(`RoomPlanner for ${this.colony.room.print} is still active! Close to save CPU.`);
		}
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

	/**
	 * Recall or reconstruct the appropriate map from memory
	 */
	private recallMap(level = this.colony.controller.level): void {
		if (this.memory.bunkerData && this.memory.bunkerData.anchor) {
			this.map = this.getStructureMapForBunkerAt(this.memory.bunkerData.anchor, level);
		} else if (this.memory.mapsByLevel) {
			this.map = _.mapValues(this.memory.mapsByLevel[level], posArr =>
				_.map(posArr, protoPos => derefRoomPosition(protoPos)));
		}
	}

	/**
	 * Return a list of room positions for planned structure locations at RCL8 (or undefined if plan isn't made yet)
	 */
	plannedStructurePositions(structureType: StructureConstant): RoomPosition[] | undefined {
		if (this.map[structureType]) {
			return this.map[structureType];
		}
		if (this.memory.bunkerData && this.memory.bunkerData.anchor) {
			return this.getBunkerStructurePlacement(structureType, this.memory.bunkerData.anchor);
		}
		const roomMap = this.memory.mapsByLevel ? this.memory.mapsByLevel[8] : undefined;
		if (roomMap && roomMap[structureType]) {
			return _.map(roomMap[structureType], protoPos => derefRoomPosition(protoPos));
		}
	}

	/**
	 * Return the planned location of the storage structure
	 */
	get storagePos(): RoomPosition | undefined {
		if (this.placements.commandCenter) {
			return this.placements.commandCenter;
		}
		const positions = this.plannedStructurePositions(STRUCTURE_STORAGE);
		if (positions) {
			return positions[0];
		}
	}

	/**
	 * Return the planned location of the spawning structure
	 */
	get hatcheryPos(): RoomPosition | undefined {
		if (this.placements.hatchery) {
			return this.placements.hatchery;
		}
		const positions = this.plannedStructurePositions(STRUCTURE_SPAWN);
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
		for (const protoFlag of this.memory.savedFlags) {
			const pos = derefRoomPosition(protoFlag.pos);
			const result = pos.createFlag(undefined, COLOR_WHITE, protoFlag.secondaryColor) as number | string;
			if (typeof result == 'string') {
				Memory.flags[result] = protoFlag.memory; // restore old memory
			}
		}
		this.memory.savedFlags = [];

		// Display the activation message
		const msg = [
			`Room planner activated for ${this.colony.name}. Reinstantiating flags from previous session on next tick.`,
			'Place colony components with room planner flags:',
			bullet + 'Place bunker (recommended)  white/red',
			bullet + 'Place hatchery:             white/green',
			bullet + 'Place command center:       white/blue',
			// 'Set component rotation by writing an angle (0,90,180,270 or 0,1,2,3) to flag.memory.rotation.',
			'Finalize layout '
		];
		_.forEach(msg, command => console.log(command));
	}

	/**
	 * Run the room planner to generate a plan and map
	 */
	private make(level = 8): void {
		// Reset everything
		this.plan = {};
		this.map = {};
		// Generate a plan, placing components by flags
		this.plan = this.generatePlan(level);
		// Flatten it into a map
		this.map = this.mapFromPlan(this.plan);
	}

	/**
	 * Adds the specified structure directly to the map. Only callable after this.map is generated.
	 * Doesn't check for conflicts, so don't use freely.
	 */
	private placeStructure(type: StructureConstant, pos: RoomPosition): void {
		if (!this.map[type]) this.map[type] = [];
		this.map[type].push(pos);
	}

	addComponent(componentName: 'hatchery' | 'commandCenter' | 'bunker', pos: RoomPosition, rotation = 0): void {
		this.placements[componentName] = pos;
	}

	/**
	 * Switcher that takes a component name and returns a layout
	 */
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

	/**
	 * Generate a plan of component placements for a given RCL
	 */
	private generatePlan(level = 8): RoomPlan {
		const plan: RoomPlan = {};
		for (const name in this.placements) {
			const layout = this.getLayout(name);
			if (layout) {
				const anchor: Coord = layout.data.anchor;
				const pos = this.placements[<'hatchery' | 'commandCenter' | 'bunker'>name];
				if (!pos) continue;
				// let rotation: number = pos!.lookFor(LOOK_FLAGS)[0]!.memory.rotation || 0;
				const componentMap = this.parseLayout(layout, level);
				this.translateComponent(componentMap, anchor, pos!);
				// if (rotation != 0) this.rotateComponent(componentMap, pos!, rotation);
				plan[name] = {
					map     : componentMap,
					pos     : new RoomPosition(anchor.x, anchor.y, this.colony.name),
					rotation: 0,
				};
			}
		}
		return plan;
	}

	/**
	 * Generate a map of (structure type: RoomPositions[]) for a given layout
	 */
	private parseLayout(structureLayout: StructureLayout, level = 8): StructureMap {
		const map = {} as StructureMap;
		const layout = structureLayout[level];
		if (layout) {
			for (const buildingName in layout.buildings) {
				map[buildingName] = _.map(layout.buildings[buildingName].pos,
										  pos => new RoomPosition(pos.x, pos.y, this.colony.name));
			}
		}
		return map;
	}

	/**
	 * Generate a flatened map from a plan
	 */
	private mapFromPlan(plan: RoomPlan): StructureMap {
		const map: StructureMap = {};
		const componentMaps: StructureMap[] = _.map(plan, componentPlan => componentPlan.map);
		const structureNames: string[] = _.unique(_.flatten(_.map(componentMaps, map => _.keys(map))));
		for (const name of structureNames) {
			map[name] = _.compact(_.flatten(_.map(componentMaps, map => map[name])));
		}
		return map;
	}

	/**
	 * Aligns the component position to the desired position; operations done in-place
	 */
	private translateComponent(map: StructureMap, fromPos: RoomPosition | Coord, toPos: RoomPosition | Coord): void {
		const dx = toPos.x - fromPos.x;
		const dy = toPos.y - fromPos.y;
		for (const structureType in map) {
			for (const pos of map[structureType]) {
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
		for (const structureType in map) {
			for (const pos of map[structureType]) {
				offset = [pos.x - pivot.x, pos.y - pivot.y];
				[dx, dy] = R(offset);
				pos.x = pivot.x + dx;
				pos.y = pivot.y + dy;
			}
		}
	}

	/**
	 * Get bunker building placements as a StructureMap
	 */
	getStructureMapForBunkerAt(anchor: { x: number, y: number }, level = 8): StructureMap {
		const dx = anchor.x - bunkerLayout.data.anchor.x;
		const dy = anchor.y - bunkerLayout.data.anchor.y;
		const structureLayout = _.mapValues(bunkerLayout[level]!.buildings, obj => obj.pos) as { [s: string]: Coord[] };
		return _.mapValues(structureLayout, coordArr =>
			_.map(coordArr, coord => new RoomPosition(coord.x + dx, coord.y + dy, this.colony.name)));
	}

	/**
	 * Get the placement for a single type of structure for bunker layout
	 */
	getBunkerStructurePlacement(structureType: string, anchor: { x: number, y: number },
								level = 8): RoomPosition[] {
		const dx = anchor.x - bunkerLayout.data.anchor.x;
		const dy = anchor.y - bunkerLayout.data.anchor.y;
		return _.map(bunkerLayout[level]!.buildings[structureType].pos,
					 coord => new RoomPosition(coord.x + dx, coord.y + dy, this.colony.name));
	}

	/**
	 * Generates a list of impassible obstacles from this.map or from this.memory.map
	 */
	getObstacles(): RoomPosition[] {
		let obstacles: RoomPosition[] = [];
		const passableStructureTypes: string[] = [STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART];
		if (_.keys(this.map).length > 0) { // if room planner has made the map, use that
			for (const structureType in this.map) {
				if (!passableStructureTypes.includes(structureType)) {
					obstacles = obstacles.concat(this.map[structureType]);
				}
			}
		} else { // else, serialize from memory
			if (this.memory.bunkerData && this.memory.bunkerData.anchor) {
				const structureMap = this.getStructureMapForBunkerAt(this.memory.bunkerData.anchor);
				for (const structureType in structureMap) {
					if (!passableStructureTypes.includes(structureType)) {
						obstacles = obstacles.concat(structureMap[structureType]);
					}
				}
			} else if (this.memory.mapsByLevel) {
				for (const structureType in this.memory.mapsByLevel[8]) {
					if (!passableStructureTypes.includes(structureType)) {
						obstacles = obstacles.concat(_.map(this.memory.mapsByLevel[8][structureType],
														   protoPos => derefRoomPosition(protoPos)));
					}
				}
			}
		}
		return _.unique(obstacles);
	}

	/**
	 * Check to see if there are any structures that can't be built
	 */
	private findCollision(ignoreRoads = false): RoomPosition | undefined {
		const terrain = Game.map.getRoomTerrain(this.colony.room.name);
		for (const structureType in this.map) {
			if (ignoreRoads && structureType == STRUCTURE_ROAD) {
				continue;
			}
			for (const pos of this.map[structureType]) {
				if (terrain.get(pos.x, pos.y) == TERRAIN_MASK_WALL) {
					return pos;
				}
			}
		}
	}

	/**
	 * Write everything to memory at the end of activation. If ignoreRoads is set, it will allow collisions with
	 * roads, but will continue to alert you every time it fails to build a road in the terrain pos (WIP)
	 */
	finalize(ignoreRoads = false): void {
		const collision = this.findCollision(ignoreRoads);
		if (collision) {
			log.warning(`Invalid layout: collision detected at ${collision.print}!`);
			return;
		}
		const layoutIsValid: boolean = (!!this.placements.commandCenter && !!this.placements.hatchery)
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
			const flagsToWrite = _.filter(this.colony.flags, flag => flag.color == COLOR_WHITE);
			for (const flag of flagsToWrite) {
				this.memory.savedFlags.push({
												secondaryColor: flag.secondaryColor,
												pos           : flag.pos,
												memory        : flag.memory,
											});
				flag.remove();
			}
			this.memory.lastGenerated = Game.time;
			console.log('Room layout and flag positions have been saved.');
			// Destroy needed buildings
			if (this.colony.level == 1) { // clear out room if setting in for first time
				this.demolishMisplacedStructures(true, true);
				// Demolish all barriers that aren't yours
				for (const barrier of this.colony.room.barriers) {
					if (barrier.structureType == STRUCTURE_WALL || !barrier.my) {
						barrier.destroy();
					}
				}
			}
			this.memory.recheckStructuresAt = Game.time + 3;
			this.active = false;
		} else {
			log.warning('Not a valid room layout! Must have both hatchery and commandCenter placements ' +
						'or bunker placement.');
		}
	}

	/* Whether a constructionSite should be placed at a position */
	static canBuild(structureType: BuildableStructureConstant, pos: RoomPosition): boolean {
		if (!pos.room) return false;
		const buildings = _.filter(pos.lookFor(LOOK_STRUCTURES), s => s && s.structureType == structureType);
		const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
		if (!buildings || buildings.length == 0) {
			if (!sites || sites.length == 0) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether a structure (or constructionSite) of given type should be at location.
	 */
	structureShouldBeHere(structureType: StructureConstant, pos: RoomPosition,
						  level = this.colony.controller.level): boolean {
		if (structureType == STRUCTURE_ROAD) {
			return this.roadShouldBeHere(pos);
		} else if (structureType == STRUCTURE_RAMPART) {
			return this.barrierPlanner.barrierShouldBeHere(pos);
		} else if (structureType == STRUCTURE_EXTRACTOR) {
			return pos.lookFor(LOOK_MINERALS).length > 0;
		} else {
			if (_.isEmpty(this.map)) {
				this.recallMap(level);
			}
			const positions = this.map[structureType];
			if (positions && _.find(positions, p => p.isEqualTo(pos))) {
				return true;
			}
			if (structureType == STRUCTURE_CONTAINER || structureType == STRUCTURE_LINK) {
				const thingsBuildingLinksAndContainers = _.map([...this.colony.room.sources,
																this.colony.room.mineral!,
																this.colony.controller], thing => thing.pos);
				const maxRange = 4;
				return pos.findInRange(thingsBuildingLinksAndContainers, 4).length > 0;
			}
		}
		return false;
	}

	/**
	 * Demolish all hostile structures in the room
	 */
	private demolishHostileStructures(destroyStorageUnits = false) {
		_.forEach(this.colony.room.walls, wall => wall.destroy()); // overmind never uses walls
		for (const structure of _.filter(this.colony.room.hostileStructures)) {
			if ((structure.structureType != STRUCTURE_STORAGE && structure.structureType != STRUCTURE_TERMINAL)
				|| destroyStorageUnits) {
				structure.destroy();
			}
		}
	}

	/**
	 * Remove all hostile constructionSites and ones which are misplaced
	 */
	private removeMisplacedConstructionSites() {
		for (const site of this.colony.room.find(FIND_CONSTRUCTION_SITES)) {
			if (site.owner.username != MY_USERNAME) {
				site.remove();
			} else if (!this.structureShouldBeHere(site.structureType, site.pos)) {
				site.remove();
			}
		}
	}

	/**
	 * Create construction sites for any buildings that need to be built
	 */
	private demolishMisplacedStructures(skipRamparts = true, destroyAllStructureTypes = false): void {

		this.demolishHostileStructures();
		this.removeMisplacedConstructionSites();

		if (getAllColonies().length <= 1 && !this.colony.storage) {
			return; // Not safe to move structures until you have multiple colonies or a storage
		}
		// Start terminal evacuation if it needs to be moved
		if (this.colony.terminal) {
			if (this.colony.storage && !this.structureShouldBeHere(STRUCTURE_STORAGE, this.colony.storage.pos)
				|| !this.structureShouldBeHere(STRUCTURE_TERMINAL, this.colony.terminal.pos)) {
				DirectiveTerminalRebuildState.createIfNotPresent(this.colony.terminal.pos, 'pos');
			}
		}

		// Max buildings that can be placed each tick
		const count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;

		// Recall the appropriate map
		this.recallMap();
		if (!this.map || this.map == {}) { // in case a map hasn't been generated yet
			log.info(this.colony.name + ' does not have a room plan yet! Unable to demolish errant structures.');
		}

		// Destroy extractor if needed
		if (this.colony.room.extractor && !this.colony.room.extractor.my) {
			this.colony.room.extractor.destroy();
		}

		// Build missing structures from room plan
		this.memory.relocating = false;
		for (const priority of DemolishStructurePriorities) {
			const structureType = priority.structureType;

			// // don't demolish bunker baby ramparts until the new ones are sufficiently big
			// if (structureType == STRUCTURE_RAMPART && this.colony.layout == 'bunker') {
			// 	let bunkerBarriers = _.filter(this.colony.room.barriers, b => insideBunkerBounds(b.pos, this.colony));
			// 	let avgBarrierHits = (_.sum(bunkerBarriers, barrier => barrier.hits) / bunkerBarriers.length) || 0;
			// 	if (avgBarrierHits < 1e+6) continue;
			// }

			const maxRemoved = priority.maxRemoved || Infinity;
			let removeCount = 0;
			let structures: Structure[] = _.filter(this.colony.room.find(FIND_STRUCTURES),
												   s => s.structureType == structureType);
			if (structureType == STRUCTURE_WALL) {
				structures = _.filter(structures, wall => wall.hits != undefined); // can't destroy newbie walls
			}

			// Loop through all structures and conditionally remove ones which are misplaced
			for (const structure of structures) {

				if (!this.structureShouldBeHere(structureType, structure.pos) ||
					(isOwnedStructure(structure) && !structure.my)) {

					// Don't demolish your own ramparts, just let them decay
					if (skipRamparts && !destroyAllStructureTypes && structure.structureType == STRUCTURE_RAMPART
						&& (<StructureRampart>structure).my) {
						continue;
					}

					// remove misplaced structures or hostile owned structures, with exceptions below
					if (this.colony.level < 4
						&& (structureType == STRUCTURE_STORAGE || structureType == STRUCTURE_TERMINAL)) {
						break; // don't destroy terminal or storage when under RCL4 - can use energy inside
					}
					if (structureType != STRUCTURE_WALL && structureType != STRUCTURE_RAMPART) {
						this.memory.relocating = true;
					}

					// Don't remove the terminal until you have rebuilt storage
					if (this.colony.level >= 6 && structureType == STRUCTURE_TERMINAL) {
						if (!this.colony.storage) {
							log.info(`${this.colony.name}: waiting until storage is built to remove terminal`);
							return;
						} else if (this.colony.terminal &&
								   _.sum(this.colony.terminal.store) - this.colony.terminal.energy > 1000) {
							log.info(`${this.colony.name}: waiting on resources to evacuate before removing terminal`);
							return;
						} else if (this.colony.storage &&
								   this.structureShouldBeHere(STRUCTURE_STORAGE, this.colony.storage.pos) &&
								   this.colony.storage.energy
								   < Energetics.settings.storage.energy.destroyTerminalThreshold) {
							log.info(`${this.colony.name}: waiting to move energy to storage before removing terminal`);
							return;
						}
					}

					// Only remove a maximum number of structures at a time
					const amountMissing = CONTROLLER_STRUCTURES[structureType][this.colony.level] - structures.length
										  + removeCount;
					if (amountMissing < maxRemoved) {
						if (structureType == STRUCTURE_SPAWN && this.colony.spawns.length == 1) {
							const spawnCost = 15000;
							if (this.colony.assets[RESOURCE_ENERGY] < spawnCost) {
								log.warning(`${this.colony.print}: Unsafe to destroy misplaced spawn: ` +
											`${this.colony.assets[RESOURCE_ENERGY]}/${spawnCost} energy available`);
								if (!destroyAllStructureTypes) {
									return;
								}
							}
							const workTicksNeeded = 15000 / BUILD_POWER;
							const workTicksAvailable = _.sum(this.colony.overlords.work.workers, worker =>
								worker.getActiveBodyparts(WORK) * (worker.ticksToLive || 0));
							if (workTicksAvailable < workTicksNeeded) {
								log.warning(`${this.colony.print}: Unsafe to destroy misplaced spawn: ` +
											`${workTicksAvailable}/${workTicksNeeded} [WORK * ticks] available`);
								if (!destroyAllStructureTypes) {
									return;
								}
							}
						}
						const result = structure.destroy();
						if (result != OK) {
							log.warning(`${this.colony.name}: couldn't destroy structure of type ` +
										`"${structureType}" at ${structure.pos.print}. Result: ${result}`);
						} else {
							log.info(`${this.colony.name}: destroyed ${structureType} at ${structure.pos.print}`);
						}
						removeCount++;
						this.memory.recheckStructuresAt = Game.time + RoomPlanner.settings.recheckAfter;
					}

				}
			}

			if (this.memory.relocating && !destroyAllStructureTypes) {
				return;
			}
		}
	}

	/**
	 * Create construction sites for any buildings that need to be built
	 */
	private buildMissingStructures(): void {
		// Max buildings that can be placed each tick
		let count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;
		// Recall the appropriate map
		this.recallMap();
		if (!this.map || this.map == {}) { // in case a map hasn't been generated yet
			log.info(this.colony.name + ' does not have a room plan yet! Unable to build missing structures.');
		}
		// Build missing structures from room plan
		for (const structureType of BuildPriorities) {
			if (this.map[structureType]) {
				for (const pos of this.map[structureType]) {
					if (count > 0 && RoomPlanner.canBuild(structureType, pos)) {
						const result = pos.createConstructionSite(structureType);
						if (result != OK) {
							const structures = pos.lookFor(LOOK_STRUCTURES);
							for (const structure of structures) {
								// let thisImportance = _.findIndex(BuildPriorities, type => type == structureType);
								// let existingImportance = _.findIndex(BuildPriorities,
								// 									 type => type == structure.structureType);
								const safeTypes: string[] = [STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_SPAWN];
								// Destroy the structure if it is less important and not protected
								if (!this.structureShouldBeHere(structure.structureType, pos)
									&& !safeTypes.includes(structure.structureType)) {
									const result = structure.destroy();
									log.info(`${this.colony.name}: destroyed ${structure.structureType} at` +
											 ` ${structure.pos.print}`);
									if (result == OK) {
										this.memory.recheckStructuresAt = Game.time +
																		  RoomPlanner.settings.recheckAfter;
									}
								}
							}
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
		const mineral = this.colony.room.find(FIND_MINERALS)[0];
		if (mineral) {
			const extractor = mineral.pos.lookForStructure(STRUCTURE_EXTRACTOR);
			if (!extractor) {
				mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR);
			}
		}
	}

	/**
	 * Calculate where the link will be built
	 */
	private calculateLinkPos(anchor: RoomPosition): RoomPosition | undefined {
		if (anchor.isEqualTo(this.colony.controller.pos)) {
			return this.calculateUpgradeSiteLinkPos();
		}
		let originPos: RoomPosition | undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.storagePos) {
			originPos = this.storagePos;
		}
		if (originPos) {
			const path = Pathing.findShortestPath(anchor, originPos).path;
			return _.find(path, pos => anchor.getRangeTo(pos) == 2);
		}
	}

	/**
	 * Calculate where the link will be built for this site
	 */
	private calculateUpgradeSiteLinkPos(): RoomPosition | undefined {
		let originPos: RoomPosition | undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.storagePos) {
			originPos = this.storagePos;
		}
		if (originPos && this.colony.upgradeSite.batteryPos) {
			// Build link at last location on path from origin to battery
			const path = Pathing.findShortestPath(this.colony.upgradeSite.batteryPos, originPos).path;
			return path[0];
		}
	}

	private nextNeededLinkAnchor(): RoomPosition | undefined {
		const linksEtAl = _.map((<(StructureLink | ConstructionSite)[]>[])
									.concat(this.colony.links, _.filter(this.colony.constructionSites,
																		site => site.structureType == STRUCTURE_LINK)),
								s => s.pos);
		// UpgradeSite goes first
		const upgradeLink = this.colony.controller.pos.findClosestByLimitedRange(linksEtAl, 3);
		if (!upgradeLink) return this.colony.controller.pos;
		// MiningSites by decreasing distance
		const origin = (this.colony.storage || this.colony.terminal || _.first(this.colony.spawns) || this.colony).pos;
		const farthestSources = _.sortBy(this.colony.room.sources, source => -1 * Pathing.distance(origin, source.pos));
		for (const source of farthestSources) {
			const sourceLink = source.pos.findClosestByLimitedRange(linksEtAl, 2);
			if (!sourceLink) return source.pos;
		}
	}

	/**
	 * Builds links as they become available. UpgradeSite gets link first, then miningSites by distance.
	 */
	private buildNeededLinks() {
		const numLinks = this.colony.links.length +
						 _.filter(this.colony.constructionSites, site => site.structureType == STRUCTURE_LINK).length;
		const numLinksAllowed = CONTROLLER_STRUCTURES.link[this.colony.level];
		if (numLinksAllowed > numLinks &&
			(this.colony.bunker || (this.colony.hatchery && this.colony.hatchery.link)) &&
			this.colony.commandCenter && this.colony.commandCenter.link) {
			const anchor = this.nextNeededLinkAnchor();
			if (!anchor) {
				return;
			}
			const linkPos = this.calculateLinkPos(anchor);
			if (!linkPos) {
				log.warning(`Could not calculate link position for anchor at ${anchor.print}!`);
				return;
			}
			linkPos.createConstructionSite(STRUCTURE_LINK);
		}
	}

	/**
	 * Quick lookup for if a road should be in this position. Roads returning false won't be maintained.
	 */
	roadShouldBeHere(pos: RoomPosition): boolean {
		return this.roadPlanner.roadShouldBeHere(pos);
	}

	init(): void {
		if (this.active && getAutonomyLevel() == Autonomy.Automatic) {
			let bunkerAnchor: RoomPosition;
			if (this.colony.spawns.length > 0) { // in case of very first spawn
				const lowerRightSpawn = maxBy(this.colony.spawns, s => 50 * s.pos.y + s.pos.x)!;
				const spawnPos = lowerRightSpawn.pos;
				bunkerAnchor = new RoomPosition(spawnPos.x - 4, spawnPos.y, spawnPos.roomName);
			} else {
				const expansionData = this.colony.room.memory[_RM.EXPANSION_DATA];
				if (expansionData) {
					bunkerAnchor = derefCoords(expansionData.bunkerAnchor, this.colony.room.name);
				} else {
					log.error(`Cannot determine anchor! No spawns or expansionData.bunkerAnchor!`);
					return;
				}
			}
			this.addComponent('bunker', bunkerAnchor);
		}
		this.barrierPlanner.init();
		this.roadPlanner.init();
	}

	shouldRecheck(offset = 0): boolean {
		if (Game.time == (this.memory.recheckStructuresAt || Infinity) + offset) {
			return true;
		} else if (this.colony.level == 8) {
			return Game.time % (2 * RoomPlanner.settings.siteCheckFrequency) == 2 * this.colony.id + offset;
		} else {
			return Game.time % RoomPlanner.settings.siteCheckFrequency == 2 * this.colony.id + offset;
		}
	}

	run(): void {
		if (this.active) {
			this.make();
			this.visuals();
		} else {
			// Build missing structures from the layout
			if (this.shouldRecheck()) {
				this.demolishMisplacedStructures();
			} else if (this.shouldRecheck(1)) {
				this.buildMissingStructures();
			}
			// Build missing links as needed
			if (Game.time % RoomPlanner.settings.linkCheckFrequency == 3) {
				this.buildNeededLinks();
			}
		}
		// Run the barrier planner
		this.barrierPlanner.run();
		// Run the road planner
		this.roadPlanner.run();
		if (this.active && getAutonomyLevel() == Autonomy.Automatic) {
			if (this.placements.bunker) {
				this.finalize();
			} else {
				log.warning(`No bunker placement!`);
			}
		}
	}

	visuals(): void {
		// Draw the map
		if (getAutonomyLevel() < Autonomy.Automatic) {
			const expansionData = this.colony.room.memory[_RM.EXPANSION_DATA];
			if (expansionData) {
				const bunkerPos = derefCoords(expansionData.bunkerAnchor, this.colony.room.name);
				if (bunkerPos) {
					Visualizer.drawLayout(bunkerLayout, bunkerPos, {opacity: 0.2});
				}
			}
		}
		Visualizer.drawStructureMap(this.map);
	}

}
