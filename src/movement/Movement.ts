// This is my custom movement library for use in Overmind. It was originally based on BonzAI's traveler module, but has
// been modified to integrate more tightly with my AI.

import {profile} from '../profiler/decorator';
import {log} from '../lib/logger/log';
import {isExit, normalizePos, sameCoord} from './helpers';
import {ROOMTYPE_ALLEY, ROOMTYPE_SOURCEKEEPER, WorldMap} from '../utilities/WorldMap';

export const NO_ACTION = -20;

// this might be higher than you wish, setting it lower is a great way to diagnose creep behavior issues. When creeps
// need to repath to often or they aren't finding valid paths, it can sometimes point to problems elsewhere in your code
const REPORT_CPU_THRESHOLD = 1000;

const DEFAULT_MAXOPS = 20000;
const DEFAULT_STUCK_VALUE = 2;

const STATE_PREV_X = 0;
const STATE_PREV_Y = 1;
const STATE_STUCK = 2;
const STATE_CPU = 3;
const STATE_DEST_X = 4;
const STATE_DEST_Y = 5;
const STATE_DEST_ROOMNAME = 6;


@profile
export class Movement {

	/* Move a creep to a destination */
	static goTo(creep: Creep, destination: HasPos | RoomPosition, options: MoveOptions = {}): number {
		destination = normalizePos(destination);
		this.updateRoomStatus(creep.room);

		if (creep.fatigue > 0) {
			Movement.circle(creep.pos, 'aqua', .3);
			return ERR_TIRED;
		}

		// Fixes bug that causes creeps to idle on the other side of a room
		let distanceToEdge = _.min([destination.x, 49 - destination.x, destination.y, 49 - destination.y]);
		if (options.range && distanceToEdge <= options.range) {
			options.range = Math.min(Math.abs(distanceToEdge - 1), 0);
		}

		// manage case where creep is nearby destination
		let rangeToDestination = creep.pos.getRangeTo(destination);
		if (options.range && rangeToDestination <= options.range) {
			return NO_ACTION;
		} else if (rangeToDestination <= 1) {
			if (rangeToDestination == 1 && !options.range) {
				let direction = creep.pos.getDirectionTo(destination);
				if (options.returnData) {
					options.returnData.nextPos = destination;
					options.returnData.path = direction.toString();
				}
				return creep.move(direction);
			}
			return NO_ACTION;
		}

		// initialize data object
		if (!creep.memory._trav) {
			creep.memory._trav = {} as TravelData;
		}
		let travelData = creep.memory._trav as TravelData;

		let state = this.deserializeState(travelData, destination);

		// uncomment to visualize destination
		// this.circle(destination.pos, "orange");

		// check if creep is stuck
		if (this.isStuck(creep, state)) {
			state.stuckCount++;
			Movement.circle(creep.pos, 'magenta', state.stuckCount * .2);
		} else {
			state.stuckCount = 0;
		}

		// handle case where creep is stuck
		if (!options.stuckValue) {
			options.stuckValue = DEFAULT_STUCK_VALUE;
		}
		if (state.stuckCount >= options.stuckValue && Math.random() > .5) {
			options.ignoreCreeps = false;
			options.freshMatrix = true;
			delete travelData.path;
		}

		// delete path cache if destination is different
		if (!destination.isEqualTo(state.destination)) {
			if (options.movingTarget && state.destination.isNearTo(destination)) {
				travelData.path += state.destination.getDirectionTo(destination);
				state.destination = destination;
			} else {
				delete travelData.path;
			}
		}

		if (options.repath && Math.random() < options.repath) {
			// add some chance that you will find a new path randomly
			delete travelData.path;
		}

		// pathfinding
		let newPath = false;
		if (!travelData.path) {
			newPath = true;
			if (creep.spawning) {
				return ERR_BUSY;
			}

			state.destination = destination;

			let cpu = Game.cpu.getUsed();
			let ret = this.findTravelPath(creep.pos, destination, options);

			let cpuUsed = Game.cpu.getUsed() - cpu;
			state.cpu = _.round(cpuUsed + state.cpu);
			if (Game.time % 10 == 0 && state.cpu > REPORT_CPU_THRESHOLD) {
				// see note at end of file for more info on this
				log.alert(`TRAVELER: heavy cpu use: ${creep.name}, cpu: ${state.cpu} origin: ${
							  creep.pos.print}, dest: ${destination.print}`);
			}

			let color = 'orange';
			if (ret.incomplete) {
				// uncommenting this is a great way to diagnose creep behavior issues
				// console.log(`TRAVELER: incomplete path for ${creep.name}`);
				color = 'red';
			}

			if (options.returnData) {
				options.returnData.pathfinderReturn = ret;
			}

			travelData.path = Movement.serializePath(creep.pos, ret.path, color);
			state.stuckCount = 0;
		}

		this.serializeState(creep, destination, state, travelData);

		if (!travelData.path || travelData.path.length == 0) {
			return ERR_NO_PATH;
		}

		// consume path
		if (state.stuckCount == 0 && !newPath) {
			travelData.path = travelData.path.substr(1);
		}

		let nextDirection = parseInt(travelData.path[0], 10);
		if (options.returnData) {
			if (nextDirection) {
				let nextPos = Movement.positionAtDirection(creep.pos, nextDirection);
				if (nextPos) {
					options.returnData.nextPos = nextPos;
				}
			}
			options.returnData.state = state;
			options.returnData.path = travelData.path;
		}
		return creep.move(<DirectionConstant>nextDirection);
	}

	static pushCreep(creep: Creep, insist = true): boolean {
		let nextDir = this.nextDirectionInPath(creep);
		if (!nextDir) return false;

		let nextPos = this.positionAtDirection(creep.pos, nextDir);
		if (!nextPos) return false;

		let otherCreep = nextPos.lookFor(LOOK_CREEPS)[0];
		if (!otherCreep) return false;

		let otherData = otherCreep.memory._trav as TravelData;
		if (!insist && otherData && otherData.path && otherData.path.length > 1) {
			return false;
		}

		let pushDirection = otherCreep.pos.getDirectionTo(creep);
		let outcome = otherCreep.move(pushDirection);
		if (outcome != OK) return false;

		if (otherData && otherData.path) {
			otherData.path = nextDir + otherData.path;
			// otherData.delay = 1;
		}
		return true;
	}

	public static nextDirectionInPath(creep: Creep): number | undefined {
		let travelData = creep.memory._trav as TravelData;
		if (!travelData || !travelData.path || travelData.path.length == 0) {
			return;
		}
		return Number.parseInt(travelData.path[0]);
	}

	public static nextPositionInPath(creep: Creep): RoomPosition | undefined {
		let nextDir = this.nextDirectionInPath(creep);
		if (!nextDir) {
			return;
		}
		return this.positionAtDirection(creep.pos, nextDir);
	}

	/* Check if the room should be avoiding when calculating routes */
	public static shouldAvoid(roomName: string) {
		return Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].avoid;
	}

	/* Draw a circle */
	public static circle(pos: RoomPosition, color: string, opacity?: number) {
		new RoomVisual(pos.roomName).circle(pos, {
			radius: .45, fill: 'transparent', stroke: color, strokeWidth: .15, opacity: opacity
		});
	}

	/* Update memory on whether a room should be avoided based on controller owner */
	public static updateRoomStatus(room: Room) {
		if (!room) {
			return;
		}
		if (room.controller) {
			if (room.controller.owner && !room.controller.my && room.towers.length > 0) {
				room.memory.avoid = 1;
			} else {
				delete room.memory.avoid;
			}
		}
	}

	/* Find a path from origin to destination */
	public static findTravelPath(origin: RoomPosition, destination: RoomPosition,
								 options: MoveOptions = {}): PathfinderReturn {

		_.defaults(options, {
			ignoreCreeps: true,
			maxOps      : DEFAULT_MAXOPS,
			range       : 1,
		});

		if (options.movingTarget) {
			options.range = 0;
		}

		// check to see whether findRoute should be used
		let roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
		let allowedRooms = options.route;
		if (!allowedRooms && (options.useFindRoute || (options.useFindRoute == undefined && roomDistance > 2))) {
			allowedRooms = this.findRoute(origin.roomName, destination.roomName, options);
		}

		let callback = (roomName: string) => this.roomCallback(roomName, origin, destination, allowedRooms, options);
		let ret = PathFinder.search(origin, {pos: destination, range: options.range!}, {
			maxOps      : options.maxOps,
			maxRooms    : options.maxRooms,
			plainCost   : options.offRoad ? 1 : options.ignoreRoads ? 1 : 2,
			swampCost   : options.offRoad ? 1 : options.ignoreRoads ? 5 : 10,
			roomCallback: callback,
		});

		if (ret.incomplete && options.ensurePath) {
			if (options.useFindRoute == undefined) {
				// handle case where pathfinder failed at a short distance due to not using findRoute
				// can happen for situations where the creep would have to take an uncommonly indirect path
				// options.allowedRooms and options.routeCallback can also be used to handle this situation
				if (roomDistance <= 2) {
					log.warning(`TRAVELER: path failed without findroute. Origin: ${origin.print}, ` +
								`destination: ${destination.print}. Trying again with options.useFindRoute = true...`);
					options.useFindRoute = true;
					ret = this.findTravelPath(origin, destination, options);
					log.warning(`TRAVELER: second attempt was ${ret.incomplete ? 'not ' : ''}successful`);
					return ret;
				}
			} else {

			}
		}
		return ret;
	}

	private static roomCallback(roomName: string, origin: RoomPosition, destination: RoomPosition,
								allowedRooms: { [roomName: string]: boolean } | undefined,
								options: MoveOptions): CostMatrix | boolean {
		if (allowedRooms && !allowedRooms[roomName]) {
			return false;
		}
		if (!options.allowHostile && Movement.shouldAvoid(roomName)
			&& roomName != origin.roomName && roomName != destination.roomName) {
			return false;
		}

		const room = Game.rooms[roomName];
		if (room) {
			let matrix: CostMatrix;
			if (options.ignoreCreeps == false) {
				matrix = this.getCreepMatrix(room);
			} else if (options.avoidSK && WorldMap.roomType(room.name) == ROOMTYPE_SOURCEKEEPER) {
				matrix = this.getSkMatrix(room);
			} else {
				matrix = this.getDefaultMatrix(room);
			}
			// Register other obstacles
			if (options.obstacles) {
				matrix = matrix.clone();
				for (let obstacle of options.obstacles) {
					if (obstacle.roomName == roomName) {
						matrix.set(obstacle.x, obstacle.y, 0xff);
					}
				}
			}
			return matrix;
		} else { // have no vision
			return true;
		}
	}

	// Cost matrix computations ========================================================================================

	/* Default matrix for a room, setting impassable structures and constructionSites to impassible */
	private static getDefaultMatrix(room: Room): CostMatrix {
		if (room._defaultMatrix) {
			return room._defaultMatrix;
		}
		const matrix = new PathFinder.CostMatrix();
		// Set passability of structure positions
		let impassibleStructures: Structure[] = [];
		_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
			if (s.structureType == STRUCTURE_ROAD) {
				matrix.set(s.pos.x, s.pos.y, 1);
			} else if (s.blocksMovement) {
				impassibleStructures.push(s);
			}
		});
		_.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
		// Set passability of construction sites
		_.forEach(room.find(FIND_CONSTRUCTION_SITES), (cs: ConstructionSite): void => {
			if (cs.my && cs.structureType != STRUCTURE_RAMPART && cs.structureType != STRUCTURE_ROAD) {
				matrix.set(cs.pos.x, cs.pos.y, 0xff);
			}
		});
		room._defaultMatrix = matrix;
		return room._defaultMatrix;
	}

	/* Avoids creeps in a room */
	private static getCreepMatrix(room: Room): CostMatrix {
		if (room._creepMatrix) {
			return room._creepMatrix;
		}
		const matrix = this.getDefaultMatrix(room).clone();
		_.forEach(room.find(FIND_CREEPS), c => matrix.set(c.pos.x, c.pos.y, 0xff));
		room._creepMatrix = matrix;
		return room._creepMatrix;
	}

	/* Avoids source keepers in a room */
	private static getSkMatrix(room: Room): CostMatrix {
		if (room._skMatrix) {
			return room._skMatrix;
		}
		const matrix = this.getDefaultMatrix(room).clone();
		const toAvoid = _.compact([...room.sources, room.mineral]);
		const range = 4;
		_.forEach(toAvoid, (center: RoomObject) => {
			for (let dx = -range; dx <= range; dx++) {
				for (let dy = -range; dy <= range; dy++) {
					matrix.set(center.pos.x + dx, center.pos.y + dy, 0xff);
				}
			}
		});
		room._skMatrix = matrix;
		return room._skMatrix;
	}

	/* Find a viable sequence of rooms to narrow down Pathfinder algorithm */
	static findRoute(origin: string, destination: string,
					 options: MoveOptions = {}): { [roomName: string]: boolean } | undefined {
		let restrictDistance = options.restrictDistance || Game.map.getRoomLinearDistance(origin, destination) + 10;
		let allowedRooms = {[origin]: true, [destination]: true};
		let highwayBias = options.preferHighway ? 2.5 : 1;

		let ret = Game.map.findRoute(origin, destination, {
			routeCallback: (roomName: string) => {
				let rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
				if (rangeToRoom > restrictDistance) { // room is too far out of the way
					return Number.POSITIVE_INFINITY;
				}
				if (!options.allowHostile && Movement.shouldAvoid(roomName) &&
					roomName !== destination && roomName !== origin) { // room is marked as "avoid" in room memory
					return Number.POSITIVE_INFINITY;
				}

				let parsed;
				if (options.preferHighway && WorldMap.roomType(roomName) == ROOMTYPE_ALLEY) {
					return 1;
				}

				return highwayBias;
			},
		});

		if (!_.isArray(ret)) {
			log.warning(`Movement: couldn't findRoute from ${origin} to ${destination}!`);
		} else {
			for (let value of ret) {
				allowedRooms[value.room] = true;
			}
			return allowedRooms;
		}
	}

	/* Serialize a path as a string of move directions */
	static serializePath(startPos: RoomPosition, path: RoomPosition[], color = 'orange'): string {
		let serializedPath = '';
		let lastPosition = startPos;
		this.circle(startPos, color);
		for (let position of path) {
			if (position.roomName == lastPosition.roomName) {
				new RoomVisual(position.roomName)
					.line(position, lastPosition, {color: color, lineStyle: 'dashed'});
				serializedPath += lastPosition.getDirectionTo(position);
			}
			lastPosition = position;
		}
		return serializedPath;
	}

	/* Returns a position at a direction from origin */
	static positionAtDirection(origin: RoomPosition, direction: number): RoomPosition | undefined {
		let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
		let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
		let x = origin.x + offsetX[direction];
		let y = origin.y + offsetY[direction];
		if (x > 49 || x < 0 || y > 49 || y < 0) {
			return;
		}
		return new RoomPosition(x, y, origin.roomName);
	}

	private static deserializeState(travelData: TravelData, destination: RoomPosition): TravelState {
		let state = {} as TravelState;
		if (travelData.state) {
			state.lastCoord = {x: travelData.state[STATE_PREV_X], y: travelData.state[STATE_PREV_Y]};
			state.cpu = travelData.state[STATE_CPU];
			state.stuckCount = travelData.state[STATE_STUCK];
			state.destination = new RoomPosition(travelData.state[STATE_DEST_X], travelData.state[STATE_DEST_Y],
												 travelData.state[STATE_DEST_ROOMNAME]);
		} else {
			state.cpu = 0;
			state.destination = destination;
		}
		return state;
	}

	private static serializeState(creep: Creep, destination: RoomPosition, state: TravelState, travelData: TravelData) {
		travelData.state = [creep.pos.x, creep.pos.y, state.stuckCount, state.cpu, destination.x, destination.y,
							destination.roomName];
	}

	private static isStuck(creep: Creep, state: TravelState): boolean {
		let stuck = false;
		if (state.lastCoord !== undefined) {
			if (sameCoord(creep.pos, state.lastCoord)) { // didn't move
				stuck = true;
			} else if (isExit(creep.pos) && isExit(state.lastCoord)) { // moved against exit
				stuck = true;
			}
		}
		return stuck;
	}
}

Creep.prototype.goTo = function (destination: RoomPosition | HasPos, options?: MoveOptions) {
	return Movement.goTo(this, destination, options);
};

