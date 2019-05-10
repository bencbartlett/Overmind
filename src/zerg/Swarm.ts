import {log} from '../console/log';
import {hasPos} from '../declarations/typeGuards';
import {CombatIntel} from '../intel/CombatIntel';
import {Mem} from '../memory/Memory';
import {normalizePos} from '../movement/helpers';
import {CombatMoveOptions, Movement, NO_ACTION, SwarmMoveOptions} from '../movement/Movement';
import {CombatOverlord} from '../overlords/CombatOverlord';
import {profile} from '../profiler/decorator';
import {CombatTargeting} from '../targeting/CombatTargeting';
import {GoalFinder} from '../targeting/GoalFinder';
import {getCacheExpiration, rotatedMatrix} from '../utilities/utils';
import {CombatZerg, DEFAULT_SWARM_TICK_DIFFERENCE} from './CombatZerg';

export interface ProtoSwarm {
	creeps: Creep[] | CombatZerg[];
}

interface SwarmMemory {
	_go?: MoveData;
	creeps: string[];
	orientation: TOP | BOTTOM | LEFT | RIGHT;
	target?: {
		id: string;
		exp: number;
	};
	numRetreats: number;
	initialAssembly?: boolean;
	recovering?: boolean;
	lastInDanger?: number;
}

const SwarmMemoryDefaults: SwarmMemory = {
	creeps     : [],
	orientation: TOP,
	numRetreats: 0,
};

const ERR_NOT_ALL_OK = -7;

interface SwarmOverlord extends CombatOverlord {
	memory: any;
}

const DEBUG = true;

/**
 * Swarms represent a coordinated group of creeps moving as a single unit and use special-purpose pathing and movement
 * functions to ensure they don't get separated
 */
@profile
export class Swarm implements ProtoSwarm {

	private overlord: SwarmOverlord;
	memory: SwarmMemory;
	ref: string;
	creeps: CombatZerg[];							// All creeps involved in the swarm
	uniformCreepType: boolean;						// Whether the swarm is composed of all one type of creep
	formation: (CombatZerg | undefined)[][]; 		// Relative ordering of the creeps accounting for orientation
	staticFormation: (CombatZerg | undefined)[][];	// Relative ordering of the creeps assuming a TOP orientation
	width: number;									// Width of the formation
	height: number;									// Height of the formation
	anchor: RoomPosition;							// Top left position of the formation regardless of orientation
	rooms: Room[];
	roomsByName: { [roomName: string]: Room };
	fatigue: number;								// Maximum fatigue of all creeps in the swarm

	constructor(overlord: SwarmOverlord, ref: string, creeps: CombatZerg[], width = 2, height = 2) {
		this.overlord = overlord;
		this.ref = ref;
		this.memory = Mem.wrap(overlord.memory, `swarm:${ref}`, SwarmMemoryDefaults);
		// Build the static formation by putting attackers at the front and healers at the rear
		const paddedCreeps: (CombatZerg | undefined)[] = _.clone(creeps);
		for (let i = paddedCreeps.length; i < width * height; i++) {
			paddedCreeps.push(undefined); // fill in remaining positions with undefined
		}
		const creepScores = this.getCreepScores(paddedCreeps);
		const sortedCreeps = _.sortBy(paddedCreeps,
									creep => creepScores[creep != undefined ? creep.name : 'undefined']);
		this.uniformCreepType = (_.unique(_.filter(_.values(creepScores), score => score != 0)).length <= 1);
		this.staticFormation = _.chunk(sortedCreeps, width);
		this.width = width;
		this.height = height;
		const firstCreepIndex = _.findIndex(sortedCreeps);
		let leadPos: RoomPosition; // upper left corner of formation when in TOP orientation
		if (firstCreepIndex != -1) {
			const firstCreepPos = sortedCreeps[firstCreepIndex]!.pos;
			const dx = firstCreepIndex % width;
			const dy = Math.floor(firstCreepIndex / width);
			leadPos = firstCreepPos.getOffsetPos(-dx, -dy);
		} else {
			leadPos = this.overlord.pos;
		}
		switch (this.orientation) {
			case TOP:
				this.anchor = leadPos;
				break;
			case RIGHT:
				this.anchor = leadPos.getOffsetPos(-1 * (height - 1), 0);
				break;
			case BOTTOM:
				this.anchor = leadPos.getOffsetPos(-1 * (width - 1), -1 * (height - 1));
				break;
			case LEFT:
				this.anchor = leadPos.getOffsetPos(0, -1 * (width - 1));
				break;
		}
		this.formation = rotatedMatrix(this.staticFormation, this.rotationsFromOrientation(this.orientation));
		this.creeps = creeps;
		this.rooms = _.unique(_.map(this.creeps, creep => creep.room), room => room.name);
		this.roomsByName = _.zipObject(_.map(this.rooms, room => [room.name, room]));
		this.fatigue = _.max(_.map(this.creeps, creep => creep.fatigue));
		this.debug(`\n${this.print} tick ${Game.time} ========================================`);
		// this.debug(`Orientation: ${this.orientation}, anchor: ${this.anchor.print}, leadPos: ${leadPos.print}`);
		// this.debug(`Formation: ${this.printFormation(this.formation)}`);
		// this.debug(`StaticFormation: ${this.printFormation(this.staticFormation)}`);

	}

	private getCreepScores(creeps: (CombatZerg | undefined)[]): { [name: string]: number } {
		const keys = _.map(creeps, c => c != undefined ? c.name : 'undefined');
		const values = _.map(creeps, z => {
			if (z == undefined) {
				return 0;
			} else {
				const score = CombatIntel.getAttackPotential(z.creep) + CombatIntel.getRangedAttackPotential(z.creep)
							  + CombatIntel.getDismantlePotential(z.creep) - CombatIntel.getHealPotential(z.creep);
				return (-1 * score) || 1;
			}
		});
		return _.zipObject(keys, values);
	}

	private printFormation(formation: (CombatZerg | undefined)[][]): string {
		const names = _.map(formation, creeps => _.map(creeps, creep => creep ? creep.name : 'NONE'));
		const SPACE = '    ';
		let msg = '';
		for (const row of names) {
			msg += '\n' + SPACE;
			for (const name of row) {
				if (name != 'NONE') {
					const role = name.split('_')[0];
					const num = name.split('_')[1];
					const shortName = role.slice(0, 4 - num.length) + num;
					msg += shortName;
				} else {
					msg += name;
				}
				msg += ' ';
			}
		}
		return msg;
	}

	get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.anchor.roomName + '">[' + `Swarm ` + this.ref + ']</a>';
	}

	debug(...args: any[]) {
		if (DEBUG) {
			console.log(args);
		}
	}

	// This should occasionally be executed at run() phase
	static cleanMemory(overlord: { swarms: { [ref: string]: Swarm }, memory: any }) {
		for (const ref in overlord.swarms) {
			// TODO
		}
	}

	get target(): Creep | Structure | undefined {
		if (this.memory.target && this.memory.target.exp > Game.time) {
			const target = Game.getObjectById(this.memory.target.id);
			if (target) {
				return target as Creep | Structure;
			}
		}
		// If nothing found
		delete this.memory.target;
	}

	set target(targ: Creep | Structure | undefined) {
		if (targ) {
			this.memory.target = {id: targ.id, exp: getCacheExpiration(100)};
		} else {
			delete this.memory.target;
		}
	}

	get orientation(): TOP | BOTTOM | LEFT | RIGHT {
		return this.memory.orientation;
	}

	set orientation(direction: TOP | BOTTOM | LEFT | RIGHT) {
		this.memory.orientation = direction;
		this.formation = rotatedMatrix(this.staticFormation, this.rotationsFromOrientation(direction));
	}

	/**
	 * Pivots the swarm formation clockwise or counterclockwise
	 */
	private pivot(direction: 'clockwise' | 'counterclockwise'): number {
		if (this.fatigue > 0) {
			return ERR_TIRED;
		}
		this.debug(`Rotating ${direction}`);
		const [
				  [c1, c2],
				  [c3, c4]
			  ] = this.formation;
		this.debug(`c1...c4: ${this.printFormation([
													   [c1, c2],
													   [c3, c4]
												   ])}`);
		let r1, r2, r3, r4: number = OK;
		if (direction == 'clockwise') {
			if (c1) r1 = c1.move(RIGHT);
			if (c2) r2 = c2.move(BOTTOM);
			if (c3) r3 = c3.move(TOP);
			if (c4) r4 = c4.move(LEFT);
		} else {
			if (c1) r1 = c1.move(BOTTOM);
			if (c2) r2 = c2.move(LEFT);
			if (c3) r3 = c3.move(RIGHT);
			if (c4) r4 = c4.move(TOP);
		}

		const allMoved = _.all([r1, r2, r3, r4], r => r == OK);

		if (allMoved) {
			return OK;
		} else {
			for (const creep of this.creeps) {
				creep.cancelOrder('move');
			}
			return -1 * (_.findIndex([r1, r2, r3, r4], r => r != OK) || 899) - 100;
		}
	}

	/**
	 * Reverses the orientation of the swarm formation in an X pattern to preserve the reflective parity of the
	 * original formation
	 */
	private swap(direction: 'horizontal' | 'vertical'): number {
		if (this.fatigue > 0) {
			return ERR_TIRED;
		}
		this.debug(`Swapping ${direction}ly`);
		const [
				  [c1, c2],
				  [c3, c4]
			  ] = this.formation;
		this.debug(`c1...c4: ${this.printFormation([
													   [c1, c2],
													   [c3, c4]
												   ])}`);
		let r1, r2, r3, r4: number = OK;

		// This operation is actually the same for both horizontal and vertical swaps
		if (c1) r1 = c1.move(BOTTOM_RIGHT);
		if (c2) r2 = c2.move(BOTTOM_LEFT);
		if (c3) r3 = c3.move(TOP_RIGHT);
		if (c4) r4 = c4.move(TOP_LEFT);

		const allMoved = _.all([r1, r2, r3, r4], r => r == OK);

		if (allMoved) {
			return OK;
		} else {
			for (const creep of this.creeps) {
				creep.cancelOrder('move');
			}
			return -1 * (_.findIndex([r1, r2, r3, r4], r => r != OK) || 899) - 100;
		}
	}

	rotate(direction: TOP | BOTTOM | LEFT | RIGHT): number {
		if (direction == this.orientation) {
			// do nothing
			return NO_ACTION;
		}

		if (!(this.width == 2 && this.height == 2)) {
			console.log('NOT IMPLEMENTED FOR LARGER SWARMS YET');
			return -100;
		}

		let ret = -777;
		if (this.fatigue > 0) {
			ret = ERR_TIRED;
		} else {
			const prevDirection = this.orientation;
			const prevFormation = this.formation;
			const prevAngle = this.rotationsFromOrientation(prevDirection);
			const newAngle = this.rotationsFromOrientation(direction);
			const rotateAngle = newAngle - prevAngle;

			if (rotateAngle == 3 || rotateAngle == -1) {
				ret = this.pivot('counterclockwise');
			} else if (rotateAngle == 1 || rotateAngle == -3) {
				ret = this.pivot('clockwise');
			} else if (rotateAngle == 2 || rotateAngle == -2) {
				if (newAngle % 2 == 0) {
					ret = this.swap('vertical');
				} else {
					ret = this.swap('horizontal');
				}
			}
			if (ret == OK) {
				this.orientation = direction;
			}
		}

		this.debug(`Rotating to ${direction}, result: ${ret}`);
		return ret;
	}

	/**
	 * Number of clockwise 90 degree turns corresponding to an orientation
	 */
	private rotationsFromOrientation(direction: TOP | BOTTOM | LEFT | RIGHT): 0 | 1 | 2 | 3 {
		switch (direction) {
			case TOP:
				return 0;
			case RIGHT:
				return 1;
			case BOTTOM:
				return 2;
			case LEFT:
				return 3;
		}
	}

	// Swarm assignment ================================================================================================


	// Range finding methods ===========================================================================================

	minRangeTo(obj: RoomPosition | HasPos): number {
		if (hasPos(obj)) {
			return _.min(_.map(this.creeps, creep =>
				creep.pos.roomName === obj.pos.roomName ? creep.pos.getRangeToXY(obj.pos.x, obj.pos.y) : Infinity));
		} else {
			return _.min(_.map(this.creeps, creep =>
				creep.pos.roomName === obj.roomName ? creep.pos.getRangeToXY(obj.x, obj.y) : Infinity));
		}
	}

	maxRangeTo(obj: RoomPosition | HasPos): number {
		if (hasPos(obj)) {
			return _.max(_.map(this.creeps, creep =>
				creep.pos.roomName === obj.pos.roomName ? creep.pos.getRangeToXY(obj.pos.x, obj.pos.y) : Infinity));
		} else {
			return _.max(_.map(this.creeps, creep =>
				creep.pos.roomName === obj.roomName ? creep.pos.getRangeToXY(obj.x, obj.y) : Infinity));
		}
	}

	findInMinRange(targets: HasPos[], range: number): HasPos[] {
		const initialRange = range + Math.max(this.width, this.height) - 1;
		const targetsInRange = _.filter(targets, t => this.anchor.inRangeToXY(t.pos.x, t.pos.y, initialRange));
		return _.filter(targetsInRange, t => this.minRangeTo(t) <= range);
	}

	/**
	 * Compute the "average" direction to a target
	 */
	getDirectionTo(obj: RoomPosition | HasPos): DirectionConstant {
		const pos = normalizePos(obj);
		const directions = _.map(this.creeps, creep => creep.pos.getDirectionTo(obj));
		// TODO
		log.warning(`NOT IMPLEMENTED`);
		return TOP;
	}

	// Formation methods ===============================================================================================

	/**
	 * Generates a table of formation positions for each creep
	 */
	private getFormationPositionsFromAnchor(anchor: RoomPosition): { [creepName: string]: RoomPosition } {
		const formationPositions: { [creepName: string]: RoomPosition } = {};
		for (let dy = 0; dy < this.formation.length; dy++) {
			for (let dx = 0; dx < this.formation[dy].length; dx++) {
				if (this.formation[dy][dx]) {
					formationPositions[this.formation[dy][dx]!.name] = anchor.getOffsetPos(dx, dy);
				}
			}
		}
		// this.debug(`Formation positions: `, JSON.stringify(formationPositions));
		return formationPositions;
	}

	/**
	 * Returtn whether every creep in the swarm is in the position dictated by formation
	 */
	isInFormation(anchor = this.anchor): boolean {
		const formationPositions = this.getFormationPositionsFromAnchor(anchor);
		return _.all(this.creeps, creep => creep.pos.isEqualTo(formationPositions[creep.name]));
	}

	get hasMaxCreeps(): boolean {
		return this.creeps.length == this.width * this.height;
	}

	/**
	 * Returns true if the swarm has lost a creep and the oldest living creep is too old to partner with a new one
	 */
	get isExpired(): boolean {
		if (!this.hasMaxCreeps) {
			const minTicksToLive = _.min(_.map(this.creeps, creep => creep.ticksToLive || 9999)) || 0;
			const spawnBuffer = 150 + 25;
			const newCreepTicksToLive = CREEP_LIFE_TIME + spawnBuffer; // TTL of a creep spawned right now
			return newCreepTicksToLive - minTicksToLive >= DEFAULT_SWARM_TICK_DIFFERENCE;
		} else {
			return false;
		}
	}

	get inMultipleRooms(): boolean {
		return _.keys(this.roomsByName).length > 1;
	}

	/**
	 * Assemble the swarm at the target location
	 */
	assemble(assemblyPoint: RoomPosition, allowIdleCombat = true): boolean {
		if (this.isInFormation(assemblyPoint) && this.hasMaxCreeps) {
			this.memory.initialAssembly = true;
			return true;
		} else {
			// Creeps travel to their relative formation positions
			const formationPositions = this.getFormationPositionsFromAnchor(assemblyPoint);
			console.log(JSON.stringify(formationPositions));
			for (const creep of this.creeps) {
				if (creep.hasValidTask) {
					// Ignore creeps which have tasks (usually getting boosted)
					continue;
				}
				if (allowIdleCombat && creep.room.dangerousPlayerHostiles.length > 0 && !this.hasMaxCreeps) {
					creep.autoSkirmish(creep.room.name);
				} else {
					const destination = formationPositions[creep.name];
					const ret = creep.goTo(destination, {
						noPush                   : creep.pos.inRangeToPos(destination, 5),
						ignoreCreepsOnDestination: true,
						// ignoreCreeps: !creep.pos.inRangeToPos(destination, Math.max(this.width, this.height))
					});
					console.log(`${creep.print} moves to ${destination.print}, response: ${ret}`);
				}
			}
			return false;
		}
	}

	private findRegroupPosition(): RoomPosition {
		let x, y: number;
		const MAX_RADIUS = 10;
		for (let radius = 0; radius < MAX_RADIUS; radius++) {
			for (let dx = -radius; dx <= radius; dx++) {
				for (let dy = -radius; dy <= radius; dy++) {
					if (Math.abs(dy) !== radius && Math.abs(dx) !== radius) {
						continue;
					}
					x = this.anchor.x + dx;
					y = this.anchor.y + dy;
					if (x < 0 || x > 49 || y < 0 || y > 49) {
						continue;
					}
					let allPathable = true;
					const pos = new RoomPosition(x, y, this.anchor.roomName);
					for (let i = 0; i < this.formation.length; i++) {
						for (let j = 0; j < this.formation[i].length; j++) {
							if (!pos.getOffsetPos(i, j).isWalkable(true)) {
								allPathable = false;
							}
						}
					}
					if (allPathable) {
						return pos;
					}
				}
			}
		}
		// Should never reach here!
		return new RoomPosition(-10, -10, 'cannotFindLocationPosition');
	}

	/**
	 * Try to re-assemble the swarm at the nearest possible location in case it broke formation
	 */
	regroup(): boolean {
		if (this.isInFormation(this.anchor)) {
			return true;
		} else {
			const regroupPosition = this.findRegroupPosition();
			this.debug(`Reassembling at ${regroupPosition.print}`);
			return this.assemble(regroupPosition, false);
		}
	}

	// Movement methods ================================================================================================

	move(direction: DirectionConstant): number {
		let allMoved = true;
		for (const creep of this.creeps) {
			const result = creep.move(direction);
			this.debug(`${creep.print} move ${direction}, result: ${result}`);
			if (result != OK) {
				allMoved = false;
			}
		}
		if (!allMoved) {
			for (const creep of this.creeps) {
				creep.cancelOrder('move');
			}
		}
		return allMoved ? OK : ERR_NOT_ALL_OK;
	}

	goTo(destination: RoomPosition | HasPos, options: SwarmMoveOptions = {}): number {
		// if (DEBUG) {
		// 	options.displayCostMatrix = true;
		// }
		return Movement.swarmMove(this, destination, options);
	}

	goToRoom(roomName: string, options: SwarmMoveOptions = {}): number {
		// if (DEBUG) {
		// 	options.displayCostMatrix = true;
		// }
		return Movement.goToRoom_swarm(this, roomName, options);
	}

	combatMove(approach: PathFinderGoal[], avoid: PathFinderGoal[], options: CombatMoveOptions = {}): number {
		// if (DEBUG) {
		// 	options.displayAvoid = true;
		// }
		const ret = Movement.swarmCombatMove(this, approach, avoid, options);
		this.debug(`Moving... Result: ${ret}`);
		return ret;
	}

	safelyInRoom(roomName: string): boolean {
		return _.all(this.creeps, creep => creep.safelyInRoom(roomName));
	}

	// private getBestSiegeOrientation(room: Room): TOP | RIGHT | BOTTOM | LEFT {
	// 	let targets: HasPos[] = [];
	// 	let structureTargets = this.findInMinRange(room.hostileStructures, 1);
	// 	for (let structure of structureTargets) {
	// 		targets.push(structure);
	// 	}
	// 	this.debug(`Targets: `, _.map(targets, t => t.pos.print));
	// 	if (targets.length == 0) {
	// 		return this.orientation;
	// 	}
	// 	let dxList = _.flatten(_.map(this.creeps,
	// 								 creep => _.map(targets,
	// 												target => target.pos.x - creep.pos.x))) as number[];
	// 	let dyList = _.flatten(_.map(this.creeps,
	// 								 creep => _.map(targets,
	// 												target => target.pos.y - creep.pos.y))) as number[];
	// 	let dx = _.sum(dxList) / dxList.length || 0;
	// 	let dy = _.sum(dyList) / dyList.length || 0;
	// 	this.debug(`dx: ${dx}, dy: ${dy}`);
	// 	if (Math.abs(dx) > Math.abs(dy)) {
	// 		return dx > 0 ? RIGHT : LEFT;
	// 	} else {
	// 		return dy > 0 ? BOTTOM : TOP;
	// 	}
	// }

	reorient(includeStructures = true, includeCreeps = false): number {
		if (this.uniformCreepType) {
			return NO_ACTION;
		}
		const targetRoom = _.find(this.rooms, room => room.owner && !room.my);
		if (targetRoom) {
			const orientation = this.getBestOrientation(targetRoom, includeStructures, includeCreeps);
			if (orientation != this.orientation && this.fatigue == 0) {
				this.debug(`Reorienting to ${orientation}!`);
				return this.rotate(orientation);
			}
		}
		return NO_ACTION;
	}

	private getBestOrientation(room: Room, includeStructures = true, includeCreeps = false): TOP | RIGHT | BOTTOM | LEFT {
		const targets: HasPos[] = [];
		if (includeStructures) {
			const structureTargets = this.findInMinRange(room.hostileStructures, 1);
			for (const structure of structureTargets) {
				targets.push(structure);
			}
		}
		if (includeCreeps) {
			const creepTargets = this.findInMinRange(room.dangerousHostiles, 2);
			for (const creep of creepTargets) {
				targets.push(creep);
			}
		}

		this.debug(`Targets: `, _.map(targets, t => t.pos.print));
		if (targets.length == 0) {
			return this.orientation;
		}
		const dxList = _.flatten(_.map(this.creeps,
									 creep => _.map(targets,
													target => target.pos.x - creep.pos.x))) as number[];
		const dyList = _.flatten(_.map(this.creeps,
									 creep => _.map(targets,
													target => target.pos.y - creep.pos.y))) as number[];
		const dx = _.sum(dxList) / dxList.length || 0;
		const dy = _.sum(dyList) / dyList.length || 0;
		this.debug(`dx: ${dx}, dy: ${dy}`);
		if (Math.abs(dx) > Math.abs(dy)) {
			return dx > 0 ? RIGHT : LEFT;
		} else {
			return dy > 0 ? BOTTOM : TOP;
		}
	}

	// Auto-combat methods =============================================================================================

	/**
	 * Automatically melee-attack the best creep in range
	 */
	autoMelee() {
		for (const creep of this.creeps) {
			if (creep.getActiveBodyparts(ATTACK) > 0) {
				creep.autoMelee();
			}
		}
	}

	/**
	 * Automatically ranged-attack the best creep in range
	 */
	autoRanged() {
		for (const creep of this.creeps) {
			if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
				creep.autoRanged();
			}
		}
	}

	/**
	 * Automatically heal the best creep in range
	 */
	autoHeal(allowRangedHeal = true) {
		for (const creep of this.creeps) {
			if (creep.getActiveBodyparts(HEAL) > 0) {
				creep.autoHeal(allowRangedHeal);
			}
		}
	}

	/**
	 * Standard sequence of actions for sieging a room. Assumes the swarm has already initially assembled.
	 */
	autoSiege(roomName: string, waypoint?: RoomPosition) {
		this.autoMelee();
		this.autoRanged();
		this.autoHeal();

		if (!this.isInFormation()) {
			this.debug(`Regrouping!`);
			if (!_.any(this.creeps, creep => creep.pos.isEdge)) {
				return this.regroup();
			}
		}

		// Handle recovery if low on HP
		if (this.needsToRecover()) {
			this.debug(`Recovering!`);
			this.target = undefined; // invalidate target
			return this.recover();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			if (waypoint) {
				return this.goTo(waypoint);
			} else {
				return this.goToRoom(roomName);
			}
		}

		// Find a target if needed
		if (!this.target) {
			const displayCostMatrix = DEBUG;
			this.target = CombatTargeting.findBestSwarmStructureTarget(this, roomName,
																	   10 * this.memory.numRetreats, displayCostMatrix);
			this.debug(this.target);
		}

		// Approach the siege target
		if (this.target) {
			// let approach = _.map(Pathing.getPosWindow(this.target.pos, -this.width, -this.height),
			// 					 pos => ({pos: pos, range: 1}));
			const result = this.combatMove([{pos: this.target.pos, range: 1}], []);
			if (result != NO_ACTION) {
				this.debug(`Moving to target ${this.target}: ${result}`);
				return result;
			} else {
				// Move to best damage spot


				// TODO


			}
		} else {
			log.warning(`No target for swarm ${this.ref}!`);
		}

		// Orient yourself to face structure targets
		this.reorient(true, false);
	}


	/**
	 * Standard sequence of actions for fighting within a room. Assumes the swarm has already initially assembled.
	 */
	autoCombat(roomName: string, waypoint?: RoomPosition) {

		this.debug(`Running autocombat!`);

		this.autoMelee();
		this.autoRanged();
		this.autoHeal();

		if (!this.isInFormation()) {
			this.debug(`Regrouping!`);
			if (!_.any(this.creeps, creep => creep.pos.isEdge)) {
				return this.regroup();
			}
		}

		// Handle recovery if low on HP
		if (this.needsToRecover()) {
			this.debug(`Recovering!`);
			this.target = undefined; // invalidate target
			return this.recover();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			this.debug(`Going to room!`);
			// if (this.rooms[0].dangerousHostiles.length > 0) {
			//
			// } else {
			//
			// }
			if (waypoint) {
				return this.goTo(waypoint);
			} else {
				return this.goToRoom(roomName);
			}
		}

		// Maneuver around the room
		const goals = GoalFinder.swarmCombatGoals(this, true);
		this.debug(`Goals: ${JSON.stringify(goals)}`);

		if (_.any(goals.avoid, goal => this.minRangeTo(goal) <= goal.range)) {
			// If creeps nearby, try to flee first, then reorient
			let result = this.combatMove(goals.approach, goals.avoid);
			if (result != OK) {
				result = this.reorient(true, true);
			}
			return result;
		} else {
			// Otherwise try to reorient first then move
			let result = this.reorient(true, true);
			if (result != OK) {
				result = this.combatMove(goals.approach, goals.avoid);
			}
			return result;
		}

	}

	needsToRecover(recoverThreshold = 0.75, reengageThreshold = 1.0): boolean {
		let recovering: boolean;
		if (this.memory.recovering) {
			recovering = _.any(this.creeps, creep => creep.hits < creep.hitsMax * reengageThreshold);
		} else {
			recovering = _.any(this.creeps, creep => creep.hits < creep.hitsMax * recoverThreshold);
		}
		if (recovering && recovering != this.memory.recovering) {
			this.memory.numRetreats++;
		}
		this.memory.recovering = recovering;
		return recovering;
	}

	recover() {
		const allHostiles = _.flatten(_.map(this.rooms, room => room.hostiles));
		const allTowers = _.flatten(_.map(this.rooms, room => room.owner && !room.my ? room.towers : []));
		if (_.filter(allHostiles, h => this.minRangeTo(h)).length > 0 || allTowers.length > 0) {
			this.memory.lastInDanger = Game.time;
		}
		const allAvoidGoals = _.flatten(_.map(this.rooms, room => GoalFinder.retreatGoalsForRoom(room).avoid));
		const result = Movement.swarmCombatMove(this, [], allAvoidGoals);

		if (result == NO_ACTION) {
			const safeRoom = _.first(_.filter(this.rooms, room => !room.owner || room.my));
			if (safeRoom && !this.safelyInRoom(safeRoom.name)) {
				if (Game.time < (this.memory.lastInDanger || 0) + 3) {
					return this.goToRoom(safeRoom.name);
				}
			}
		}
		return result;
	}


	// Simulated swarms ================================================================================================

	/**
	 * Groups enemies into proto-swarms based on proximity to each other
	 */
	static findEnemySwarms(room: Room, anchor?: HasPos, maxClumpSize = 3): ProtoSwarm[] {
		const enemySwarms: ProtoSwarm[] = [];
		const origin = anchor || _.first(room.spawns) || room.controller || {pos: new RoomPosition(25, 25, room.name)};
		let attackers = _.sortBy(room.dangerousHostiles, creep => origin.pos.getRangeTo(creep));
		while (attackers.length > 0) {
			const clump = _.first(attackers).pos.findInRange(attackers, maxClumpSize);
			attackers = _.difference(attackers, clump);
			enemySwarms.push({creeps: clump});
		}
		return enemySwarms;
	}

}
