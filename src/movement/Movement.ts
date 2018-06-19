// This is the movement library for Overmind. It was originally based on BonzAI's Traveler library, but it has been
// extensively modified to integrate more tightly with the Overmind framework and add additional functionality.

import {profile} from '../profiler/decorator';
import {log} from '../lib/logger/log';
import {isExit, normalizePos, sameCoord} from './helpers';
import {ROOMTYPE_ALLEY, ROOMTYPE_SOURCEKEEPER, WorldMap} from '../utilities/WorldMap';
import {Zerg} from '../Zerg';

export const NO_ACTION = -20;

const REPORT_CPU_THRESHOLD = 1000; 	// Report when creep uses more than this amount of CPU over lifetime

const DEFAULT_MAXOPS = 20000;		// Default timeout for pathfinding
const DEFAULT_STUCK_VALUE = 2;		// Marked as stuck after this many ticks

const STATE_PREV_X = 0;
const STATE_PREV_Y = 1;
const STATE_STUCK = 2;
const STATE_CPU = 3;
const STATE_DEST_X = 4;
const STATE_DEST_Y = 5;
const STATE_DEST_ROOMNAME = 6;

@profile
export class Movement {

	// Core creep movement functions ===================================================================================

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
		if (!creep.memory._go) {
			creep.memory._go = {} as MoveData;
		}
		let moveData = creep.memory._go as MoveData;

		let state = this.deserializeState(moveData, destination);

		// uncomment to visualize destination
		// this.circle(destination, "orange");

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
			delete moveData.path;
		}

		// delete path cache if destination is different
		if (!destination.isEqualTo(state.destination)) {
			if (options.movingTarget && state.destination.isNearTo(destination)) {
				moveData.path += state.destination.getDirectionTo(destination);
				state.destination = destination;
			} else {
				delete moveData.path;
			}
		}

		if (options.repath && Math.random() < options.repath) {	// randomly repath with specified probability
			delete moveData.path;
		}

		// pathfinding
		let newPath = false;
		if (!moveData.path) {
			newPath = true;
			if (creep.spawning) {
				return ERR_BUSY;
			}

			state.destination = destination;

			let cpu = Game.cpu.getUsed();
			let ret = this.findPath(creep.pos, destination, options);

			let cpuUsed = Game.cpu.getUsed() - cpu;
			state.cpu = _.round(cpuUsed + state.cpu);
			if (Game.time % 10 == 0 && state.cpu > REPORT_CPU_THRESHOLD) {
				log.alert(`Movement: heavy cpu use: ${creep.name}, cpu: ${state.cpu} origin: ${
							  creep.pos.print}, dest: ${destination.print}`);
			}

			let color = 'orange';
			if (ret.incomplete) {
				// uncommenting this is a great way to diagnose creep behavior issues
				// console.log(`Movement: incomplete path for ${creep.name}`);
				color = 'red';
			}

			if (options.returnData) {
				options.returnData.pathfinderReturn = ret;
			}

			moveData.path = Movement.serializePath(creep.pos, ret.path, color);
			state.stuckCount = 0;
		}

		this.serializeState(creep, destination, state, moveData);

		if (!moveData.path || moveData.path.length == 0) {
			return ERR_NO_PATH;
		}

		// consume path
		if (state.stuckCount == 0 && !newPath) {
			moveData.path = moveData.path.substr(1);
		}

		let nextDirection = parseInt(moveData.path[0], 10);
		if (options.returnData) {
			if (nextDirection) {
				let nextPos = Movement.positionAtDirection(creep.pos, nextDirection);
				if (nextPos) {
					options.returnData.nextPos = nextPos;
				}
			}
			options.returnData.state = state;
			options.returnData.path = moveData.path;
		}
		return creep.move(<DirectionConstant>nextDirection);
	}

	/* Park a creep off-roads */
	static park(creep: Creep, pos: RoomPosition = creep.pos, maintainDistance = false): number {
		let road = creep.pos.lookForStructure(STRUCTURE_ROAD);
		if (!road) return OK;

		let positions = _.sortBy(creep.pos.availableNeighbors(), (p: RoomPosition) => p.getRangeTo(pos));
		if (maintainDistance) {
			let currentRange = creep.pos.getRangeTo(pos);
			positions = _.filter(positions, (p: RoomPosition) => p.getRangeTo(pos) <= currentRange);
		}

		let swampPosition;
		for (let position of positions) {
			if (position.lookForStructure(STRUCTURE_ROAD)) continue;
			let terrain = position.lookFor(LOOK_TERRAIN)[0];
			if (terrain === 'swamp') {
				swampPosition = position;
			} else {
				return creep.move(creep.pos.getDirectionTo(position));
			}
		}

		if (swampPosition) {
			return creep.move(creep.pos.getDirectionTo(swampPosition));
		}

		return this.goTo(creep, pos);
	}

	/* Moves a creep off of the current tile to the first available neighbor */
	static moveOffCurrentPos(creep: Creep): ScreepsReturnCode | undefined {
		let destinationPos = _.first(_.filter(creep.pos.availableNeighbors(), pos => !pos.isEdge));
		if (destinationPos) {
			return creep.move(creep.pos.getDirectionTo(destinationPos));
		}
	}

	/* Moves onto an exit tile */
	static moveOnExit(creep: Creep): ScreepsReturnCode | undefined {
		if (creep.pos.rangeToEdge > 0 && creep.fatigue == 0) {
			let directions = [1, 3, 5, 7, 2, 4, 6, 8] as DirectionConstant[];
			for (let direction of directions) {
				let position = creep.pos.getPositionAtDirection(direction);
				let terrain = position.lookFor(LOOK_TERRAIN)[0];
				if (terrain != 'wall' && position.rangeToEdge == 0) {
					let outcome = creep.move(direction);
					return outcome;
				}
			}
			log.warning(`moveOnExit() assumes nearby exit tile, position: ${creep.pos}`);
			return ERR_NO_PATH;
		}
	}

	/* Moves off of an exit tile */
	static moveOffExit(creep: Creep, avoidSwamp = true): ScreepsReturnCode {
		let swampDirection;
		let directions = [1, 3, 5, 7, 2, 4, 6, 8] as DirectionConstant[];
		for (let direction of directions) {
			let position = creep.pos.getPositionAtDirection(direction);
			if (position.rangeToEdge > 0 && position.isPassible()) {
				let terrain = position.lookFor(LOOK_TERRAIN)[0];
				if (avoidSwamp && terrain == 'swamp') {
					swampDirection = direction;
					continue;
				}
				return creep.move(direction);
			}
		}
		if (swampDirection) {
			return creep.move(swampDirection as DirectionConstant);
		}
		return ERR_NO_PATH;
	}

	/* Moves off of an exit tile toward a given direction */
	static moveOffExitToward(creep: Creep, pos: RoomPosition, detour = true): number | undefined {
		for (let position of creep.pos.availableNeighbors()) {
			if (position.getRangeTo(pos) == 1) {
				return this.goTo(creep, position);
			}
		}
		if (detour) {
			this.goTo(creep, pos, {ignoreCreeps: false});
		}
	}

	/* Push a blocking creep out of the way, switching positions */
	static pushCreep(creep: Creep, insist = true): boolean {
		let nextDir = this.nextDirectionInPath(creep);
		if (!nextDir) return false;

		let nextPos = this.positionAtDirection(creep.pos, nextDir);
		if (!nextPos) return false;

		let otherCreep = nextPos.lookFor(LOOK_CREEPS)[0];
		if (!otherCreep) return false;

		let otherData = otherCreep.memory._go as MoveData;
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

	static pairwiseMove(leader: Zerg, follower: Zerg, target: HasPos | RoomPosition,
						opts = {} as MoveOptions, allowedRange = 1): number | undefined {
		let outcome;
		if (leader.room != follower.room) {
			if (leader.pos.rangeToEdge == 0) {
				// Leader should move off of exit tiles while waiting for follower
				outcome = leader.travelTo(target, opts);
			}
			follower.travelTo(leader);
			return outcome;
		}

		let range = leader.pos.getRangeTo(follower);
		if (range > allowedRange) {
			// If leader is farther than max allowed range, allow follower to catch up
			if (follower.pos.rangeToEdge == 0 && follower.room == leader.room) {
				follower.moveOffExitToward(leader.pos);
			} else {
				follower.travelTo(leader, {stuckValue: 1});
			}
		} else if (follower.fatigue == 0) {
			// Leader should move if follower can also move this tick
			outcome = leader.travelTo(target, opts);
			if (range == 1) {
				follower.move(follower.pos.getDirectionTo(leader));
			} else {
				follower.travelTo(leader, {stuckValue: 1});
			}
		}
		return outcome;
	}

	/* Check if the room should be avoiding when calculating routes */
	static shouldAvoid(roomName: string) {
		return Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].avoid;
	}

	/* Update memory on whether a room should be avoided based on controller owner */
	static updateRoomStatus(room: Room) {
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
	static findPath(origin: RoomPosition, destination: RoomPosition, options: MoveOptions = {}): PathFinderPath {
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
					log.warning(`Movement: path failed without findroute. Origin: ${origin.print}, ` +
								`destination: ${destination.print}. Trying again with options.useFindRoute = true...`);
					options.useFindRoute = true;
					ret = this.findPath(origin, destination, options);
					log.warning(`Movement: second attempt was ${ret.incomplete ? 'not ' : ''}successful`);
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

	private static deserializeState(moveData: MoveData, destination: RoomPosition): MoveState {
		let state = {} as MoveState;
		if (moveData.state) {
			state.lastCoord = {x: moveData.state[STATE_PREV_X], y: moveData.state[STATE_PREV_Y]};
			state.cpu = moveData.state[STATE_CPU];
			state.stuckCount = moveData.state[STATE_STUCK];
			state.destination = new RoomPosition(moveData.state[STATE_DEST_X], moveData.state[STATE_DEST_Y],
												 moveData.state[STATE_DEST_ROOMNAME]);
		} else {
			state.cpu = 0;
			state.destination = destination;
		}
		return state;
	}

	private static serializeState(creep: Creep, destination: RoomPosition, state: MoveState, moveData: MoveData) {
		moveData.state = [creep.pos.x, creep.pos.y, state.stuckCount, state.cpu, destination.x, destination.y,
							destination.roomName];
	}

	private static nextDirectionInPath(creep: Creep): number | undefined {
		let moveData = creep.memory._go as MoveData;
		if (!moveData || !moveData.path || moveData.path.length == 0) {
			return;
		}
		return Number.parseInt(moveData.path[0]);
	}

	private static nextPositionInPath(creep: Creep): RoomPosition | undefined {
		let nextDir = this.nextDirectionInPath(creep);
		if (!nextDir) {
			return;
		}
		return this.positionAtDirection(creep.pos, nextDir);
	}

	private static isStuck(creep: Creep, state: MoveState): boolean {
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

	/* Draw a circle */
	private static circle(pos: RoomPosition, color: string, opacity?: number): RoomVisual {
		return new RoomVisual(pos.roomName).circle(pos, {
			radius: .45, fill: 'transparent', stroke: color, strokeWidth: .15, opacity: opacity
		});
	}
}

Creep.prototype.goTo = function (destination: RoomPosition | HasPos, options?: MoveOptions) {
	return Movement.goTo(this, destination, options);
};

