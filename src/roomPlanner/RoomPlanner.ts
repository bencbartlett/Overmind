/* Layout: plans future buildings for rooms */
import {hatcheryLayout} from './layouts/hatchery';
import {commandCenterLayout} from './layouts/commandCenter';
import {log} from '../lib/logger/log';
import {Pathing} from '../pathing/pathing';
import {Visualizer} from '../visuals/Visualizer';
import {profile} from '../lib/Profiler';
import {Memcheck} from '../memcheck';

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
	map: StructureMap;
}

@profile
export class RoomPlanner {
	roomName: string;			// Name of the room this is for
	room: Room;					// Room object
	map: StructureMap;			// Flattened {structureType: RoomPositions[]} containing the final structure placements
	plan: RoomPlan;				// Contains maps, positions, and rotations of each hivecluster component
	isActive: boolean; 			// Whether the planner is activated
	memory: PlannerMemory;		// Memory, stored on the room memory

	constructor(roomName: string) {
		this.roomName = roomName;
		this.room = Game.rooms[roomName];
		this.memory = Memcheck.safeAssign(this.room.memory, 'roomPlanner', {
			active: false,
			map   : {},
		});
		this.plan = {};
		this.isActive = this.memory.active;
		this.map = this.memory.map;
	}

	// addComponentsByFlags(): void {
	// 	let structureFlags = _.filter(this.room.flags, flag => flag.color == COLOR_GREY);
	// 	for (let flag of structureFlags) {
	// 		switch (flag.secondaryColor) {
	// 			case COLOR_PURPLE:
	// 				this.addComponent('hatchery', flag.pos, Game.time % 4);
	// 				break;
	// 			case COLOR_YELLOW:
	// 				this.addComponent('commandCenter', flag.pos, Game.time % 4);
	// 				break;
	// 		}
	// 	}
	// }

	addComponent(componentName: string, pos: RoomPosition, rotation = 0): void {
		if (this.isActive) {
			let componentLayout: StructureLayout;
			let anchor: Coord;
			switch (componentName) {
				case 'hatchery':
					componentLayout = hatcheryLayout;
					anchor = hatcheryLayout.data.pos;
					break;
				case 'commandCenter':
					componentLayout = commandCenterLayout;
					anchor = componentLayout.data.pos;
					break;
				default:
					log.error(`${componentName} is not a valid component name.`);
					return;
			}
			let componentMap = this.parseLayout(componentLayout);
			this.translateComponent(componentMap, anchor, pos);
			if (rotation != 0) {
				this.rotateComponent(componentMap, pos, rotation);
			}
			this.plan[componentName] = {
				map     : componentMap,
				pos     : new RoomPosition(anchor.x, anchor.y, this.roomName),
				rotation: rotation,
			};
		}
	}

	/* Generate a flatened map */
	private generateMap(): void {
		this.map = {};
		let componentMaps: StructureMap[] = _.map(this.plan, componentPlan => componentPlan.map);
		let structureNames: string[] = _.unique(_.flatten(_.map(componentMaps, map => _.keys(map))));
		for (let name of structureNames) {
			this.map[name] = _.compact(_.flatten(_.map(componentMaps, map => map[name])));
		}
	}

	/* Generate a map of (structure type: RoomPositions[]) for a given layout */
	private parseLayout(structureLayout: StructureLayout, level = 8): StructureMap {
		let map = {} as StructureMap;
		let layout = structureLayout[level];
		if (layout) {
			for (let buildingName in layout.buildings) {
				map[buildingName] = _.map(layout.buildings[buildingName].pos,
										  pos => new RoomPosition(pos.x, pos.y, this.roomName));
			}
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

	private planRoad(pos1: RoomPosition, pos2: RoomPosition) {
		// Find the shortest path, preferentially stepping on tiles with road routing flags on them
		let roadPath = Pathing.routeRoadPath(pos1, pos2);
		let shortestPath = Pathing.findShortestPath(pos1, pos2);
		if (roadPath.length == shortestPath.length) {
			Visualizer.drawRoad(roadPath);
		} else if (roadPath.length > shortestPath.length) {
			Visualizer.drawRoad(shortestPath);
			Visualizer.drawPath(roadPath, {stroke: 'red'});
			let textPos = roadPath[Math.floor(roadPath.length / 2 - 1)];
			Visualizer.text(`Road length: ${roadPath.length}; shortest length: ${shortestPath.length}`,
							textPos, {color: 'red'});
		} else {
			log.error(`${pos1} to ${pos2}: shortest path has length ${shortestPath.length}` +
					  `longer than road path length ${roadPath.length}`);
		}
	}

	init(): void {

	}

	run(): void {
		if (this.isActive) {
			this.generateMap();
		}
	}
}
