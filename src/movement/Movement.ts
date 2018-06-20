// This is the movement library for Overmind. It was originally based on BonzAI's Traveler library, but it has been
// extensively modified to integrate more tightly with the Overmind framework and add additional functionality.

import {profile} from '../profiler/decorator';
import {log} from '../console/log';
import {getTerrainCosts, isExit, normalizePos, sameCoord} from './helpers';
import {Zerg} from '../Zerg';
import {Pathing} from './Pathing';
import {QueenSetup} from '../overlords/core/queen';
import {TransporterSetup} from '../overlords/core/transporter';
import {ManagerSetup} from '../overlords/core/manager';

export const NO_ACTION = -20;

const REPORT_CPU_THRESHOLD = 1000; 	// Report when creep uses more than this amount of CPU over lifetime

const DEFAULT_STUCK_VALUE = 2;		// Marked as stuck after this many ticks

const STATE_PREV_X = 0;
const STATE_PREV_Y = 1;
const STATE_STUCK = 2;
const STATE_CPU = 3;
const STATE_DEST_X = 4;
const STATE_DEST_Y = 5;
const STATE_DEST_ROOMNAME = 6;

const pushyRoles = _.map([ManagerSetup, QueenSetup, TransporterSetup], setup => setup.role);

@profile
export class Movement {

	// Core creep movement functions ===================================================================================

	/* Move a creep to a destination */
	static goTo(creep: Zerg, destination: HasPos | RoomPosition, options: MoveOptions = {}): number {

		_.defaults(options, {
			pushy: pushyRoles.includes(creep.roleName),
		});

		destination = normalizePos(destination);
		Pathing.updateRoomStatus(creep.room);

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
		if (moveData.delay != undefined) {
			if (moveData.delay <= 0) {
				delete moveData.delay;
			} else {
				moveData.delay--;
				return OK;
			}
		}

		let state = this.deserializeState(moveData, destination);

		// uncomment to visualize destination
		// this.circle(destination, "orange");

		// check if creep is stuck
		let pushedCreep;
		if (this.isStuck(creep, state)) {
			state.stuckCount++;
			this.circle(creep.pos, 'magenta', state.stuckCount * .2);
			if (options.pushy) {
				pushedCreep = this.pushCreep(creep, state.stuckCount >= 1);
			}
		} else {
			state.stuckCount = 0;
		}
		// handle case where creep is stuck
		if (!options.stuckValue) {
			options.stuckValue = DEFAULT_STUCK_VALUE;
		}
		if (state.stuckCount >= options.stuckValue && !pushedCreep && Math.random() > .5) {
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

			// Compute terrain costs
			if (!options.direct && !options.terrainCosts) {
				options.terrainCosts = getTerrainCosts(creep.creep);
			}

			let cpu = Game.cpu.getUsed();
			let ret = Pathing.findPath(creep.pos, destination, options);

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

			this.circle(creep.pos, color);
			moveData.path = Pathing.serializePath(creep.pos, ret.path, color);
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
				let nextPos = Pathing.positionAtDirection(creep.pos, nextDirection);
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
	static park(creep: Zerg, pos: RoomPosition = creep.pos, maintainDistance = false): number {
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
	static moveOffCurrentPos(creep: Zerg): ScreepsReturnCode | undefined {
		let destinationPos = _.first(_.filter(creep.pos.availableNeighbors(), pos => !pos.isEdge));
		if (destinationPos) {
			return creep.move(creep.pos.getDirectionTo(destinationPos));
		}
	}

	/* Moves onto an exit tile */
	static moveOnExit(creep: Zerg): ScreepsReturnCode | undefined {
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
	static moveOffExit(creep: Zerg, avoidSwamp = true): ScreepsReturnCode {
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
	static moveOffExitToward(creep: Zerg, pos: RoomPosition, detour = true): number | undefined {
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
	static pushCreep(creep: Zerg, insist = true): boolean {
		let nextDir = Pathing.nextDirectionInPath(creep);
		if (!nextDir) return false;

		let nextPos = Pathing.positionAtDirection(creep.pos, nextDir);
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
			otherData.delay = 1;
		}
		return true;
	}

	static pairwiseMove(leader: Zerg, follower: Zerg, target: HasPos | RoomPosition,
						opts = {} as MoveOptions, allowedRange = 1): number | undefined {
		let outcome;
		if (leader.room != follower.room) {
			if (leader.pos.rangeToEdge == 0) {
				// Leader should move off of exit tiles while waiting for follower
				outcome = leader.goTo(target, opts);
			}
			follower.goTo(leader);
			return outcome;
		}

		let range = leader.pos.getRangeTo(follower);
		if (range > allowedRange) {
			// If leader is farther than max allowed range, allow follower to catch up
			if (follower.pos.rangeToEdge == 0 && follower.room == leader.room) {
				follower.moveOffExitToward(leader.pos);
			} else {
				follower.goTo(leader, {stuckValue: 1});
			}
		} else if (follower.fatigue == 0) {
			// Leader should move if follower can also move this tick
			outcome = leader.goTo(target, opts);
			if (range == 1) {
				follower.move(follower.pos.getDirectionTo(leader));
			} else {
				follower.goTo(leader, {stuckValue: 1});
			}
		}
		return outcome;
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

	private static serializeState(creep: Zerg, destination: RoomPosition, state: MoveState, moveData: MoveData) {
		moveData.state = [creep.pos.x, creep.pos.y, state.stuckCount, state.cpu, destination.x, destination.y,
						  destination.roomName];
	}

	private static isStuck(creep: Zerg, state: MoveState): boolean {
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

// Creep.prototype.goTo = function (destination: RoomPosition | HasPos, options?: MoveOptions) {
// 	return Movement.goTo(this, destination, options);
// };

